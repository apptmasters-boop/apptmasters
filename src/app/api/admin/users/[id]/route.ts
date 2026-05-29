import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  systemRole: z.enum(["USER", "MANAGER", "SUPER_ADMIN"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (id === payload.userId) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { systemRole: parsed.data.systemRole },
    select: { id: true, name: true, email: true, systemRole: true },
  });

  logAudit({ action: "SYSTEM_ROLE_CHANGED", entityType: "user", entityId: id,
    meta: { targetUser: user.name, newRole: parsed.data.systemRole },
    userId: payload.userId });

  return NextResponse.json(user);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === payload.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  await prisma.user.delete({ where: { id } });
  logAudit({ action: "ACCOUNT_DELETED", entityType: "user", entityId: id,
    meta: { targetUser: target?.name, email: target?.email },
    userId: payload.userId });
  return NextResponse.json({ success: true });
}
