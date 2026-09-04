import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { rateLimit, recordFailure, resetKey } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(9),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`2fa-verify:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

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
      const { locked } = recordFailure(`2fa-verify:email:${email}`, 5, 10 * 60_000);
      if (locked) {
        return NextResponse.json({ error: "Too many failed attempts. Please request a new code." }, { status: 429 });
      }
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    await prisma.backupCode.update({ where: { id: usedBackupCodeId }, data: { used: true, usedAt: new Date() } });
  }

  resetKey(`2fa-verify:email:${email}`);

  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}
