import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, appUrl } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.landlordInvite.create({
    data: { email: parsed.data.email, expiresAt },
  });

  const inviteUrl = `${appUrl}/landlord-invite/${invite.token}`;
  await sendEmail(
    parsed.data.email,
    "You're invited to join ApptMasters as a Landlord",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">Landlord Invitation</h2>
      <p style="color:#374151">You've been invited to manage properties on <strong>ApptMasters</strong>.</p>
      <p style="color:#374151">Click the button below to create your landlord account.</p>
      <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Create landlord account
      </a>
      <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you weren't expecting this, you can ignore it.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
    `
  );

  return NextResponse.json({ success: true, inviteUrl });
}
