import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
});

async function canManage(userId: string, apartmentId: string): Promise<boolean> {
  const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
  if (!apt) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return apt.managerId === userId || user?.systemRole === "SUPER_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: apartmentId, memberId } = await params;
  if (!(await canManage(payload.userId, apartmentId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const member = await prisma.apartmentMember.findUnique({ where: { id: memberId } });
  if (!member || member.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const updated = await prisma.apartmentMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: apartmentId, memberId } = await params;
  if (!(await canManage(payload.userId, apartmentId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.apartmentMember.findUnique({ where: { id: memberId } });
  if (!member || member.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.apartmentMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
