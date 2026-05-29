import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, passwordResetEmail, appUrl } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

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
