import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ number: z.string().min(1).max(20) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: buildingId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const building = await prisma.building.findFirst({
    where: { id: buildingId, managerId: payload.userId },
  });
  if (!building) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.unit.findFirst({
    where: { buildingId, number: parsed.data.number },
  });
  if (existing) return NextResponse.json({ error: "Unit number already exists" }, { status: 409 });

  const unit = await prisma.unit.create({
    data: { number: parsed.data.number, buildingId },
  });

  return NextResponse.json(unit, { status: 201 });
}
