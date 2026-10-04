import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken, signTwoFactorChallenge } from "@/lib/auth";
import { rateLimit, recordFailure, resetKey, isLocked, clientIp } from "@/lib/rateLimit";
import { recordLoginEvent } from "@/lib/loginEvents";
import { requiresTwoFactor, sendLoginCode } from "@/lib/twoFactor";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60_000;
const lockedResponse = () =>
  NextResponse.json({ error: "Too many failed attempts. Please try again in 15 minutes." }, { status: 429 });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  // IP-based: 5 attempts per minute — blocks bulk scanning from one address
  const { ok } = rateLimit(`login:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const lockKey = `login:email:${email}`;

  // Per-account lock, checked before the password so a correct guess is refused too
  if (isLocked(lockKey, MAX_FAILURES)) return lockedResponse();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    const { locked } = recordFailure(lockKey, MAX_FAILURES, LOCK_WINDOW_MS);
    if (user) recordLoginEvent({ userId: user.id, ip, userAgent, success: false }).catch(() => {});
    if (locked) return lockedResponse();
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
  }

  resetKey(lockKey);

  // Two-factor accounts get a challenge, never a token, until the emailed code is verified.
  if (requiresTwoFactor(user)) {
    await sendLoginCode(user);
    return NextResponse.json({ twoFactorRequired: true, challenge: signTwoFactorChallenge(user.id) });
  }

  recordLoginEvent({ userId: user.id, ip, userAgent, success: true }).catch(() => {});
  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}
