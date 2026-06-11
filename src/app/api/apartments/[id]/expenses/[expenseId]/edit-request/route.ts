import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(
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

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { splits: true },
  });
  if (!expense || expense.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (expense.paidById !== payload.userId && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the payer or admin can request edits" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Count apartment members (active only)
  const memberCount = await prisma.apartmentMember.count({
    where: { apartmentId, status: "ACTIVE" },
  });
  const requiredApprovals = Math.ceil((memberCount - 1) / 2);

  // Cancel any existing PENDING request from same requester for this expense
  await prisma.expenseEditRequest.updateMany({
    where: { expenseId, requesterId: payload.userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const request = await prisma.expenseEditRequest.create({
    data: {
      expenseId,
      requesterId: payload.userId,
      apartmentId,
      requiredApprovals,
      originalTitle: expense.title,
      originalAmount: expense.amount,
      originalCategory: expense.category,
      originalNotes: expense.notes,
      proposedTitle: parsed.data.title,
      proposedAmount: parsed.data.amount,
      proposedCategory: parsed.data.category,
      proposedNotes: parsed.data.notes !== undefined ? parsed.data.notes : undefined,
    },
    include: { requester: { select: { name: true } }, approvals: true },
  });

  // Notify all other members
  const otherMembers = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", userId: { not: payload.userId } },
    select: { userId: true },
  });

  if (otherMembers.length > 0) {
    await prisma.notification.createMany({
      data: otherMembers.map(m => ({
        userId: m.userId,
        apartmentId,
        type: "EXPENSE_EDIT_REQUEST",
        title: "Expense edit approval needed",
        body: `${request.requester.name} wants to edit "${expense.title}" — ${requiredApprovals} approval${requiredApprovals !== 1 ? "s" : ""} needed`,
        link: `/apartment/${apartmentId}/finance`,
      })),
    });
  }

  return NextResponse.json(request, { status: 201 });
}
