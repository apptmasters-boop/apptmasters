import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { sendVerificationLink } from "@/lib/emailVerification";

// Public sign-up. The account stays unusable until its email is confirmed
// (see src/lib/emailVerification.ts), so this route never returns a login token.
const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80, "Name is too long"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
  returnTo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { ok } = rateLimit(`listings-signup:ip:${ip}`, 5, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, returnTo } = parsed.data;

  // Limit confirmation emails per address, so sign-up can't be used to spam an inbox
  const { ok: emailOk } = rateLimit(`listings-signup:email:${email}`, 3, 15 * 60_000);
  if (!emailOk) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const hash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.emailVerified) {
    return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
  }

  // An unconfirmed account with this email was never usable (nobody clicked its
  // link), so whoever signs up again takes it over with their own details. Only
  // the real inbox owner can complete the confirmation.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { name, password: hash } })
    : await prisma.user.create({ data: { name, email, password: hash, emailVerified: false } });

  await sendVerificationLink(user, returnTo);

  return NextResponse.json({ pending: true, email: user.email }, { status: 201 });
}
