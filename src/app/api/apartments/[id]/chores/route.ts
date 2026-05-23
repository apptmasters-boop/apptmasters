import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  title: z.string().min(1),
  assignmentType: z.enum(["ROTATING", "FIXED", "VOLUNTARY"]).default("ROTATING"),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).default("WEEKLY"),
  dueDate: z.string().optional(),
  roomId: z.string().optional(),
  assignedUserId: z.string().optional(),
  points: z.number().int().min(1).max(10).default(2),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const chores = await prisma.chore.findMany({
    where: { apartmentId },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, photo: true } },
      completedBy: { select: { id: true, name: true } },
      photos: { orderBy: { takenAt: "desc" }, take: 3 },
      swapRequests: { where: { status: "PENDING" }, include: { fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(chores);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { dueDate, ...rest } = parsed.data;
  const chore = await prisma.chore.create({
    data: {
      ...rest,
      apartmentId,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(chore, { status: 201 });
}
