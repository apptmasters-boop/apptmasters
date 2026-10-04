import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail, joinApprovedEmail } from "@/lib/email";

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
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) return NextResponse.json({ error: "Join request not found" }, { status: 404 });

  const apartment = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { name: true } });

  await prisma.apartmentMember.update({ where: { id: memberId }, data: { status: "ACTIVE" } });

  sendEmail(
    target.user.email,
    `You've been approved to join ${apartment?.name}`,
    joinApprovedEmail(target.user.name, apartment?.name ?? "your apartment")
  ).catch(() => {});

  logAudit({
    action: "MEMBER_APPROVED",
    entityType: "member",
    entityId: memberId,
    meta: { targetUser: target.user.name },
    userId: payload.userId,
    apartmentId,
  });

  return NextResponse.json({ approved: true });
}
