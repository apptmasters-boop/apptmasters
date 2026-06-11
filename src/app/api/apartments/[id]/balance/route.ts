import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const expenses = await prisma.expense.findMany({
    where: { apartmentId, status: { not: "SETTLED" } },
    include: { splits: true },
  });

  // Build net balance map: positive = owed to you, negative = you owe
  const balances: Record<string, Record<string, number>> = {};

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.status === "PAID") continue;
      const owerId = split.userId;
      const payeeId = expense.paidById;
      if (owerId === payeeId) continue;

      if (!balances[owerId]) balances[owerId] = {};
      if (!balances[payeeId]) balances[payeeId] = {};
      balances[owerId][payeeId] = (balances[owerId][payeeId] ?? 0) - split.amount;
      balances[payeeId][owerId] = (balances[payeeId][owerId] ?? 0) + split.amount;
    }
  }

  // Simplify debts: balances[A][B] is already net (positive = A is owed by B, negative = A owes B)
  // balances[A][B] === -balances[B][A] by construction, so just use amount directly — don't subtract
  // the mirror entry or you double the value.
  const simplified: { from: string; to: string; amount: number }[] = [];
  const seen = new Set<string>();
  for (const [fromId, tos] of Object.entries(balances)) {
    for (const [toId, amount] of Object.entries(tos)) {
      const key = [fromId, toId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      if (amount > 0.01) simplified.push({ from: toId, to: fromId, amount: parseFloat(amount.toFixed(2)) });
      else if (amount < -0.01) simplified.push({ from: fromId, to: toId, amount: parseFloat((-amount).toFixed(2)) });
    }
  }

  // Fetch user names
  const userIds = [...new Set(simplified.flatMap(s => [s.from, s.to]))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  const myBalance = simplified
    .filter(s => s.from === payload.userId || s.to === payload.userId)
    .map(s => ({
      ...s,
      fromName: userMap[s.from] ?? s.from,
      toName: userMap[s.to] ?? s.to,
      direction: s.to === payload.userId ? "owed_to_you" : "you_owe",
    }));

  return NextResponse.json({ simplified, myBalance, userMap });
}

// Bulk settle all splits owed by current user to a specific person
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const { toUserId, method } = await req.json() as { toUserId: string; method: "CASH" | "BANK" };

  if (!toUserId || !["CASH", "BANK"].includes(method)) {
    return NextResponse.json({ error: "toUserId and method (CASH|BANK) required" }, { status: 400 });
  }

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find all pending splits for current user on expenses paid by toUserId
  const pendingSplits = await prisma.expenseSplit.findMany({
    where: {
      userId: payload.userId,
      status: "PENDING",
      expense: { apartmentId, paidById: toUserId },
    },
    include: { expense: { select: { id: true, title: true, paidById: true } } },
  });

  if (pendingSplits.length === 0) {
    return NextResponse.json({ error: "No pending splits found" }, { status: 404 });
  }

  const claimer = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const totalAmount = pendingSplits.reduce((sum, s) => sum + s.amount, 0);

  if (method === "CASH") {
    await prisma.expenseSplit.updateMany({
      where: {
        userId: payload.userId,
        status: "PENDING",
        expense: { apartmentId, paidById: toUserId },
      },
      data: { status: "PENDING_CASH" },
    });

    await prisma.notification.create({
      data: {
        userId: toUserId,
        apartmentId,
        type: "CASH_PAYMENT_CLAIMED",
        title: `${claimer?.name ?? "Someone"} paid you $${totalAmount.toFixed(2)} in cash`,
        body: `${claimer?.name ?? "Someone"} says they paid a total of $${totalAmount.toFixed(2)} in cash across ${pendingSplits.length} expense${pendingSplits.length !== 1 ? "s" : ""}. Please confirm each one in the Finance page.`,
        link: `/apartment/${apartmentId}/finance`,
      },
    });
  } else {
    // BANK: immediate settlement
    await prisma.expenseSplit.updateMany({
      where: {
        userId: payload.userId,
        status: "PENDING",
        expense: { apartmentId, paidById: toUserId },
      },
      data: { status: "PAID", settledAt: new Date() },
    });

    await prisma.settlement.create({
      data: {
        apartmentId,
        fromUserId: payload.userId,
        toUserId,
        amount: parseFloat(totalAmount.toFixed(2)),
        method: "BANK",
        confirmedAt: new Date(),
      },
    });

    // Check each expense — mark SETTLED if all splits are paid
    const expenseIds = [...new Set(pendingSplits.map(s => s.expense.id))];
    for (const expenseId of expenseIds) {
      const allSplits = await prisma.expenseSplit.findMany({ where: { expenseId } });
      if (allSplits.every(s => s.status === "PAID")) {
        await prisma.expense.update({ where: { id: expenseId }, data: { status: "SETTLED" } });
      }
    }
  }

  return NextResponse.json({ success: true, method, count: pendingSplits.length });
}
