import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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
    include: { user: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "Join request not found" }, { status: 404 });

  await prisma.apartmentMember.delete({ where: { id: memberId } });

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
