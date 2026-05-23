import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ROOM_TYPES = ["KITCHEN", "LIVING_ROOM", "BATHROOM", "HALLWAY", "LAUNDRY", "BALCONY", "BEDROOM", "CUSTOM"] as const;

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(ROOM_TYPES).optional().default("CUSTOM"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const rooms = await prisma.room.findMany({
    where: { apartmentId },
    include: {
      chores: {
        where: { status: { not: "DONE" } },
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
      },
      photos: { orderBy: { takenAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const room = await prisma.room.create({
    data: { ...parsed.data, apartmentId },
  });

  return NextResponse.json(room, { status: 201 });
}
