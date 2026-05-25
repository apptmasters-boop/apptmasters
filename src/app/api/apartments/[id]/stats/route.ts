import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [expenses, chores, members, rentCycles, scores] = await Promise.all([
    prisma.expense.findMany({
      where: { apartmentId },
      include: { paidBy: { select: { id: true, name: true } }, splits: true },
    }),
    prisma.chore.findMany({ where: { apartmentId } }),
    prisma.apartmentMember.findMany({
      where: { apartmentId, status: { not: "MOVED_OUT" } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.rentCycle.findMany({
      where: { apartmentId },
      include: { payments: true },
      orderBy: { month: "desc" },
      take: 6,
    }),
    prisma.roommateScore.findMany({ where: { apartmentId } }),
  ]);

  // Expense breakdown by category
  const byCategory: Record<string, number> = {};
  const thisMonthByCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    if (new Date(e.date) >= startOfMonth) {
      thisMonthByCategory[e.category] = (thisMonthByCategory[e.category] ?? 0) + e.amount;
    }
  }

  // Per-member: total paid, total owed, chores done
  const memberStats = members.map(m => {
    const paid = expenses.filter(e => e.paidBy.id === m.userId).reduce((s, e) => s + e.amount, 0);
    const owed = expenses.flatMap(e => e.splits).filter(s => s.userId === m.userId).reduce((s, sp) => s + sp.amount, 0);
    const choresDone = chores.filter(c => c.completedById === m.userId && c.status === "DONE").length;
    const choresPending = chores.filter(c => c.assignedUserId === m.userId && c.status === "PENDING").length;
    const score = scores.find(s => s.userId === m.userId)?.score ?? 50;
    return { userId: m.userId, name: m.user.name, paid, owed, choresDone, choresPending, score };
  });

  // Chore completion rate overall
  const totalDone = chores.filter(c => c.status === "DONE").length;
  const totalPending = chores.filter(c => c.status === "PENDING").length;
  const totalOverdue = chores.filter(c => c.status === "PENDING" && c.dueDate && new Date(c.dueDate) < now).length;

  // Rent summary (last 6 months)
  const rentSummary = rentCycles.map(cycle => ({
    month: cycle.month,
    total: cycle.totalAmount,
    paid: cycle.payments.filter(p => p.status !== "PENDING").reduce((s, p) => s + p.amount, 0),
    pending: cycle.payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0),
    confirmed: cycle.payments.filter(p => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0),
  }));

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonthSpend = expenses.filter(e => new Date(e.date) >= startOfMonth).reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    totalSpend,
    thisMonthSpend,
    byCategory,
    thisMonthByCategory,
    memberStats,
    chores: { totalDone, totalPending, totalOverdue },
    rentSummary,
  });
}
