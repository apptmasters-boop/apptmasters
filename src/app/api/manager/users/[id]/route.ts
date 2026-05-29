import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetId } = await params;

  if (targetId === payload.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Verify the target user has no active memberships in any of the manager's apartments
  const managedApartmentIds = (
    await prisma.apartment.findMany({
      where: { managerId: payload.userId },
      select: { id: true },
    })
  ).map(a => a.id);

  const activeMemberships = await prisma.apartmentMember.findMany({
    where: {
      userId: targetId,
      apartmentId: { in: managedApartmentIds },
      status: { not: "MOVED_OUT" },
    },
  });

  if (activeMemberships.length > 0) {
    return NextResponse.json(
      { error: "Remove the tenant from all apartments before deleting their account." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: targetId } });
  return NextResponse.json({ success: true });
}
