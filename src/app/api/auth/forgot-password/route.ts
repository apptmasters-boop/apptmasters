import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, passwordResetEmail, appUrl } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`forgot:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Per-email: 3 reset emails per hour — prevents bombing a victim's inbox from rotating IPs
  const { ok: emailOk } = rateLimit(`forgot:email:${parsed.data.email}`, 3, 60 * 60_000);
  if (!emailOk) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond success to avoid user enumeration
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { token, expiresAt, userId: user.id },
    });

    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your ApptMasters password",
      passwordResetEmail(user.name, resetUrl)
    );
  }

  return NextResponse.json({ success: true });
}
