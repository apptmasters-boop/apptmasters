import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, verifyTwoFactorChallenge } from "@/lib/auth";
import { rateLimit, recordFailure, resetKey, isLocked, clientIp } from "@/lib/rateLimit";
import { recordLoginEvent } from "@/lib/loginEvents";

// Second step of sign-in for 2FA accounts; see src/lib/twoFactor.ts for the flow.
const schema = z.object({
  challenge: z.string().min(1),
  code: z.string().min(6).max(9),
});

const MAX_FAILURES = 5;
const lockedResponse = () =>
  NextResponse.json({ error: "Too many failed attempts. Please request a new code." }, { status: 429 });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { ok } = rateLimit(`2fa-verify:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // The challenge proves the password step passed in the last 10 minutes.
  const userId = verifyTwoFactorChallenge(parsed.data.challenge);
  if (!userId) return NextResponse.json({ error: "Your sign-in expired. Please sign in again." }, { status: 401 });

  const lockKey = `2fa-verify:user:${userId}`;
  // Checked before the code, so a correct guess after 5 misses is refused too
  if (isLocked(lockKey, MAX_FAILURES)) return lockedResponse();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

  const { code } = parsed.data;
  const record = await prisma.twoFactorCode.findFirst({
    where: { userId: user.id, code, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  let usedBackupCodeId: string | null = null;

  if (record) {
    await prisma.twoFactorCode.update({ where: { id: record.id }, data: { used: true } });
  } else {
    // Fall back to a backup code (e.g. "XXXX-XXXX") for lost-device/no-email recovery
    const candidates = await prisma.backupCode.findMany({ where: { userId: user.id, used: false } });
    for (const candidate of candidates) {
      if (await bcrypt.compare(code.toUpperCase(), candidate.codeHash)) {
        usedBackupCodeId = candidate.id;
        break;
      }
    }

    if (!usedBackupCodeId) {
      // Per-account: 5 bad guesses within the code's 10-min window locks further attempts
      const { locked } = recordFailure(lockKey, MAX_FAILURES, 10 * 60_000);
      recordLoginEvent({ userId: user.id, ip, userAgent: req.headers.get("user-agent"), success: false }).catch(() => {});
      if (locked) return lockedResponse();
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    await prisma.backupCode.update({ where: { id: usedBackupCodeId }, data: { used: true, usedAt: new Date() } });
  }

  resetKey(lockKey);
  recordLoginEvent({ userId: user.id, ip, userAgent: req.headers.get("user-agent"), success: true }).catch(() => {});

  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}
