import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  assignedUserId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["PENDING", "DONE", "OVERDUE"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; choreId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, choreId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { dueDate, ...rest } = parsed.data;
  const chore = await prisma.chore.update({
    where: { id: choreId },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(chore);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; choreId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, choreId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.chore.delete({ where: { id: choreId } });
  return NextResponse.json({ success: true });
}
