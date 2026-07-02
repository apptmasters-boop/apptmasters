import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(200).optional(),
});

async function getOwnedBuilding(req: NextRequest, id: string) {
  const payload = await requireManager(req);
  if (!payload) return null;
  const building = await prisma.building.findFirst({
    where: { id, managerId: payload.userId },
  });
  return building;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const building = await prisma.building.findFirst({
    where: { id, managerId: payload.userId },
    include: {
      units: {
        include: {
          apartment: { select: { id: true, name: true, _count: { select: { members: true } } } },
          invites: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, email: true, createdAt: true },
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!building) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(building);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const building = await getOwnedBuilding(req, id);
  if (!building) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.building.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const building = await getOwnedBuilding(req, id);
  if (!building) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.building.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
