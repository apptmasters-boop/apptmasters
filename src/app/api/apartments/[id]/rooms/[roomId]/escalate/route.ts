import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { z } from "zod";
import { sendEmail, appUrl, esc } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const { id: apartmentId, roomId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };


  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const room = await prisma.room.findFirst({ where: { id: roomId, apartmentId } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // This sends mail from our domain to an address the member types in, so the
  // body is escaped and capped, the address validated, and sending rate-limited.
  const parsed = z.object({
    landlordEmail: z.string().email("Enter a valid landlord email"),
    emailBody: z.string().trim().min(1, "Describe the issue").max(5000, "Message is too long"),
  }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { landlordEmail, emailBody } = parsed.data;

  const { ok } = rateLimit(`escalate:user:${payload.userId}`, 5, 60 * 60_000);
  if (!ok) return NextResponse.json({ error: "Too many emails sent. Please try again later." }, { status: 429 });

  const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { name: true } });
  const reporter = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true, email: true } });

  const subject = `Maintenance issue — ${room.name} at ${apt?.name ?? "the apartment"}`;

  await sendEmail(landlordEmail, subject, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#dc2626;margin-bottom:4px">Maintenance Issue Report</h2>
      <p style="color:#6b7280;font-size:13px;margin-top:0">
        ${esc(apt?.name ?? "Apartment")} — ${esc(room.name)} —${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:20px 0">
        <p style="white-space:pre-wrap;color:#1f2937;font-size:15px;margin:0">${esc(emailBody)}</p>
      </div>
      <p style="color:#374151;font-size:14px">
        This issue was reported via <strong>ApptMasters</strong> by <strong>${esc(reporter?.name ?? "a tenant")}</strong>${reporter?.email ? ` (${esc(reporter.email)})` : ""}.
        Please respond as soon as possible.
      </p>
      <a href="${appUrl}/apartment/${apartmentId}/maintenance"
        style="display:inline-block;margin:16px 0;background:#dc2626;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px">
        View maintenance details
      </a>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `);

  // Mark room as escalated and notify members
  await prisma.room.update({ where: { id: roomId }, data: { escalatedAt: new Date() } });

  const others = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", userId: { not: payload.userId } },
    select: { userId: true },
  });
  if (others.length > 0) {
    await prisma.notification.createMany({
      data: others.map(m => ({
        userId: m.userId,
        apartmentId,
        type: "MAINTENANCE_ESCALATED",
        title: `${room.name} issue escalated to landlord`,
        body: `${reporter?.name ?? "Someone"} emailed the landlord about the ${room.name} maintenance issue.`,
        link: `/apartment/${apartmentId}/maintenance`,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
