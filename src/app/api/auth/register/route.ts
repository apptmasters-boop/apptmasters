import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail, verificationEmail, appUrl } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`register:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({ data: { token, expiresAt, userId: user.id } });

  const verifyUrl = `${appUrl}/verify-email?token=${token}`;
  await sendEmail(email, "Verify your ApptMasters email", verificationEmail(name, verifyUrl));

  return NextResponse.json({ success: true });
}
