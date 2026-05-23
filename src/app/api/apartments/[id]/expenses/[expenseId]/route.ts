import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "SETTLED", "DISPUTED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, expenseId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const expense = await prisma.expense.update({ where: { id: expenseId }, data: parsed.data });
  return NextResponse.json(expense);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, expenseId } = await params;
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.apartmentId !== apartmentId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (expense.paidById !== payload.userId) {
    const m = await prisma.apartmentMember.findUnique({ where: { userId_apartmentId: { userId: payload.userId, apartmentId } } });
    if (m?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  return NextResponse.json({ success: true });
}
