import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, expenseId } = await params;
  const { userId, action } = await req.json() as { userId: string; action: "confirm" | "deny" };

  if (!userId || !["confirm", "deny"].includes(action)) {
    return NextResponse.json({ error: "userId and action (confirm|deny) required" }, { status: 400 });
  }

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, apartmentId } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (expense.paidById !== payload.userId) {
    return NextResponse.json({ error: "Only the payer can confirm cash payments" }, { status: 403 });
  }

  const split = await prisma.expenseSplit.findUnique({
    where: { expenseId_userId: { expenseId, userId } },
  });
  if (!split || split.status !== "PENDING_CASH") {
    return NextResponse.json({ error: "No pending cash payment found for this user" }, { status: 404 });
  }

  const payer = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  if (action === "confirm") {
    await prisma.expenseSplit.update({
      where: { expenseId_userId: { expenseId, userId } },
      data: { status: "PAID", settledAt: new Date() },
    });

    const allSplits = await prisma.expenseSplit.findMany({ where: { expenseId } });
    if (allSplits.every(s => s.status === "PAID")) {
      await prisma.expense.update({ where: { id: expenseId }, data: { status: "SETTLED" } });
    }

    await prisma.settlement.create({
      data: {
        apartmentId,
        fromUserId: userId,
        toUserId: payload.userId,
        amount: split.amount,
        method: "CASH",
        confirmedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        apartmentId,
        type: "CASH_PAYMENT_CONFIRMED",
        title: `${payer?.name ?? "The payer"} confirmed your cash payment`,
        body: `Your cash payment of $${split.amount.toFixed(2)} for "${expense.title}" has been confirmed.`,
        link: `/apartment/${apartmentId}/finance`,
      },
    });
  } else {
    await prisma.expenseSplit.update({
      where: { expenseId_userId: { expenseId, userId } },
      data: { status: "PENDING" },
    });

    await prisma.notification.create({
      data: {
        userId,
        apartmentId,
        type: "CASH_PAYMENT_DENIED",
        title: `${payer?.name ?? "The payer"} could not confirm your cash payment`,
        body: `Your cash payment claim of $${split.amount.toFixed(2)} for "${expense.title}" was not confirmed. Please settle again.`,
        link: `/apartment/${apartmentId}/finance`,
      },
    });
  }

  return NextResponse.json({ success: true, action });
}
