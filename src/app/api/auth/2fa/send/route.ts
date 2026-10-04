import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyTwoFactorChallenge } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { requiresTwoFactor, sendLoginCode } from "@/lib/twoFactor";

// Re-sends a sign-in code. Login already sends the first one; this needs the
// challenge from that login, so nobody can trigger codes for an arbitrary email.
const schema = z.object({ challenge: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { ok } = rateLimit(`2fa-send:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const userId = verifyTwoFactorChallenge(parsed.data.challenge);
  if (!userId) return NextResponse.json({ error: "Your sign-in expired. Please sign in again." }, { status: 401 });

  // Per-account: 3 codes per 10 minutes — codes expire in 10 min so no reason to send more
  const { ok: userOk } = rateLimit(`2fa-send:user:${userId}`, 3, 10 * 60_000);
  if (!userOk) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, twoFactorEnabled: true },
  });
  if (!user || !requiresTwoFactor(user)) return NextResponse.json({ required: false });

  await sendLoginCode(user);
  return NextResponse.json({ required: true });
}
