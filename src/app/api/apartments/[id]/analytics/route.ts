import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const expenses = await prisma.expense.findMany({
    where: { apartmentId, date: { gte: sixMonthsAgo } },
    include: {
      splits: { where: { userId: payload.userId } },
      paidBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  // By category
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  // Monthly totals
  const byMonth: Record<string, { total: number; myShare: number }> = {};
  for (const e of expenses) {
    const month = e.date.toISOString().slice(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = { total: 0, myShare: 0 };
    byMonth[month].total += e.amount;
    byMonth[month].myShare += e.splits[0]?.amount ?? 0;
  }

  // Top spenders
  const spenderMap: Record<string, { name: string; total: number }> = {};
  for (const e of expenses) {
    const id = e.paidBy.id;
    if (!spenderMap[id]) spenderMap[id] = { name: e.paidBy.name, total: 0 };
    spenderMap[id].total += e.amount;
  }
  const topSpenders = Object.values(spenderMap).sort((a, b) => b.total - a.total).slice(0, 5);

  return NextResponse.json({
    byCategory,
    byMonth,
    topSpenders,
    totalLast6Months: expenses.reduce((s, e) => s + e.amount, 0),
    myShareLast6Months: expenses.reduce((s, e) => s + (e.splits[0]?.amount ?? 0), 0),
  });
}
