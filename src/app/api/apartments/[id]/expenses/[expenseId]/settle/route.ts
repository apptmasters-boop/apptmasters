import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ method: z.enum(["VENMO", "PAYPAL", "CASHAPP", "CASH", "BANK"]).default("CASH") });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, expenseId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const method = parsed.success ? parsed.data.method : "CASH";

  const split = await prisma.expenseSplit.findUnique({
    where: { expenseId_userId: { expenseId, userId: payload.userId } },
  });
  if (!split) return NextResponse.json({ error: "No split found for you" }, { status: 404 });
  if (split.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 409 });
  if (split.status === "PENDING_CASH") return NextResponse.json({ error: "Already awaiting confirmation" }, { status: 409 });

  // Cash payments require payer confirmation
  if (method === "CASH") {
    const updated = await prisma.expenseSplit.update({
      where: { expenseId_userId: { expenseId, userId: payload.userId } },
      data: { status: "PENDING_CASH" },
    });

    const [expense, claimer] = await Promise.all([
      prisma.expense.findUnique({ where: { id: expenseId }, select: { title: true, paidById: true } }),
      prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } }),
    ]);

    if (expense) {
      await prisma.notification.create({
        data: {
          userId: expense.paidById,
          apartmentId,
          type: "CASH_PAYMENT_CLAIMED",
          title: `${claimer?.name ?? "Someone"} paid you in cash`,
          body: `${claimer?.name ?? "Someone"} says they paid $${split.amount.toFixed(2)} in cash for "${expense.title}". Please confirm or deny.`,
          link: `/apartment/${apartmentId}/finance`,
        },
      });
    }

    return NextResponse.json(updated);
  }

  // Non-cash: immediate settlement
  const updated = await prisma.expenseSplit.update({
    where: { expenseId_userId: { expenseId, userId: payload.userId } },
    data: { status: "PAID", settledAt: new Date() },
  });

  const allSplits = await prisma.expenseSplit.findMany({ where: { expenseId } });
  if (allSplits.every(s => s.status === "PAID")) {
    await prisma.expense.update({ where: { id: expenseId }, data: { status: "SETTLED" } });
  }

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (expense) {
    await prisma.settlement.create({
      data: {
        apartmentId: expense.apartmentId,
        fromUserId: payload.userId,
        toUserId: expense.paidById,
        expenseId,
        amount: split.amount,
        method,
        confirmedAt: new Date(),
      },
    });
  }

  return NextResponse.json(updated);
}
