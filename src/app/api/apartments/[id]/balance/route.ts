import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { householdDebts } from "@/lib/balances";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const simplified = await householdDebts(apartmentId);

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
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const { toUserId, method } = await req.json() as { toUserId: string; method: "CASH" | "BANK" };

  if (!toUserId || !["CASH", "BANK"].includes(method)) {
    return NextResponse.json({ error: "toUserId and method (CASH|BANK) required" }, { status: 400 });
  }

  const membership = access.membership;
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
