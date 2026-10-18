import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationLink } from "@/lib/emailVerification";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { INTENT_START, isIntent } from "@/lib/intent";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
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
    // A new link starts where their sign-up answer does (step O1); older accounts: the usual landing.
    await sendVerificationLink(user, isIntent(user.intent) ? INTENT_START[user.intent] : null);
  }

  return NextResponse.json({ success: true });
}
