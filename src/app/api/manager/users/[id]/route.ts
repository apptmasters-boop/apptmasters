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

  // A manager may only delete the account of a plain user who was a tenant in
  // one of the manager's own apartments. (Previously any user with no active
  // membership in the manager's apartments qualified, i.e. almost anyone on the
  // platform, including admins.)
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { systemRole: true, memberships: { select: { status: true, apartment: { select: { managerId: true } } } } },
  });
  const wasMyTenant = target?.memberships.some(m => m.apartment.managerId === payload.userId);
  if (!target || target.systemRole !== "USER" || !wasMyTenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Their whole account goes, so they must not still live anywhere on the platform.
  if (target.memberships.some(m => m.status !== "MOVED_OUT")) {
    return NextResponse.json(
      { error: "Remove the tenant from all apartments before deleting their account." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: targetId } });
  return NextResponse.json({ success: true });
}
