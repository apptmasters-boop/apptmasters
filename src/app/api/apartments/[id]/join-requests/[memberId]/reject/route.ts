import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: apartmentId, memberId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };


  const caller = access.membership;
  if (!caller || caller.status !== "ACTIVE" || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.apartmentMember.findFirst({
    where: { id: memberId, apartmentId, status: "PENDING_APPROVAL" },
    include: { user: { select: { name: true, email: true } }, apartment: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "Join request not found" }, { status: 404 });

  await prisma.apartmentMember.delete({ where: { id: memberId } });

  // The person waiting hears back (Join status, Sprint 11b): the request is gone, so they'd otherwise never know.
  const title = `Your request to join ${target.apartment.name}`;
  sendEmail(target.user.email, title, notificationEmail(
    title, "The household admin didn't approve this request. You can keep looking for a place on ApptMasters.",
    `${appUrl}/listings`, "Find a home",
  )).catch(() => {});

  logAudit({
    action: "MEMBER_REJECTED",
    entityType: "member",
    entityId: memberId,
    meta: { targetUser: target.user.name },
    userId: payload.userId,
    apartmentId,
  });

  return NextResponse.json({ rejected: true });
}
