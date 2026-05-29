import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function canManage(userId: string, apartmentId: string): Promise<boolean> {
  const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
  if (!apt) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return apt.managerId === userId || user?.systemRole === "SUPER_ADMIN";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!(await canManage(payload.userId, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, photo: true, systemRole: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!apartment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(apartment);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!(await canManage(payload.userId, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.apartment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
