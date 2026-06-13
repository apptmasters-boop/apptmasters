import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, verificationEmail, appUrl } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`resend-verify:ip:${ip}`, 3, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email." }, { status: 400 });

  const { ok: emailOk } = rateLimit(`resend-verify:email:${parsed.data.email}`, 3, 15 * 60_000);
  if (!emailOk) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  // Always respond success to avoid leaking whether an email exists
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.emailVerified) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerificationToken.create({ data: { token, expiresAt, userId: user.id } });
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    await sendEmail(user.email, "Verify your ApptMasters email", verificationEmail(user.name, verifyUrl));
  }

  return NextResponse.json({ success: true });
}
