import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageApartment } from "@/lib/access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!(await canManageApartment(payload.userId, id))) {
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
  if (!(await canManageApartment(payload.userId, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.apartment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
