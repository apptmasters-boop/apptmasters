import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email() });

const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY) &&
  !process.env.RESEND_API_KEY!.startsWith("re_your_");

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`2fa-send:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Per-email: 3 codes per 10 minutes — codes expire in 10 min so no reason to send more
  const { ok: emailOk } = rateLimit(`2fa-send:email:${parsed.data.email}`, 3, 10 * 60_000);
  if (!emailOk) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, twoFactorEnabled: true },
  });

  // Skip 2FA if not enabled for this user OR if email is not configured
  if (!user?.twoFactorEnabled || !isEmailConfigured()) {
    return NextResponse.json({ required: false });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.twoFactorCode.create({
    data: { userId: user.id, code, expiresAt },
  });

  await sendEmail(
    parsed.data.email,
    "Your ApptMasters login code",
    `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5">Your login code</h2>
      <p style="color:#374151">Hi ${user.name},</p>
      <p style="color:#374151">Use this code to sign in. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827;background:#f3f4f6;padding:20px 24px;border-radius:8px;text-align:center;margin:24px 0">${code}</div>
      <p style="color:#6b7280;font-size:13px">If you didn't try to sign in, ignore this email.</p>
    </div>`
  );

  return NextResponse.json({ required: true });
}
