import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
});

export async function GET(req: NextRequest) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const buildings = await prisma.building.findMany({
    where: { managerId: payload.userId },
    include: { _count: { select: { units: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(buildings);
}

export async function POST(req: NextRequest) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const building = await prisma.building.create({
    data: { ...parsed.data, managerId: payload.userId },
  });

  return NextResponse.json(building, { status: 201 });
}
