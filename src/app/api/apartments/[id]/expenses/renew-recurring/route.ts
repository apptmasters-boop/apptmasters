import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const startOfMonth = new Date(currentMonth + "-01");

  // Find recurring expenses not yet created this month
  const recurring = await prisma.expense.findMany({
    where: { apartmentId, isRecurring: true },
    include: { splits: true },
    orderBy: { date: "desc" },
  });

  // Deduplicate: keep only the latest version of each recurring title
  const seen = new Set<string>();
  const templates = recurring.filter(e => {
    if (seen.has(e.title)) return false;
    seen.add(e.title);
    return true;
  });

  // Check which ones already have an entry this month
  const thisMonthExpenses = await prisma.expense.findMany({
    where: { apartmentId, date: { gte: startOfMonth } },
    select: { title: true },
  });
  const thisMonthTitles = new Set(thisMonthExpenses.map(e => e.title));

  const created = [];
  for (const template of templates) {
    if (thisMonthTitles.has(template.title)) continue;

    const newExpense = await prisma.expense.create({
      data: {
        apartmentId,
        paidById: template.paidById,
        title: template.title,
        amount: template.amount,
        category: template.category,
        splitMethod: template.splitMethod,
        isRecurring: true,
        frequency: template.frequency,
        date: new Date(),
      },
    });

    // Recreate the splits
    if (template.splits.length > 0) {
      await prisma.expenseSplit.createMany({
        data: template.splits.map(s => ({
          expenseId: newExpense.id,
          userId: s.userId,
          amount: s.amount,
        })),
      });
    }

    created.push(newExpense.title);
  }

  return NextResponse.json({ created, count: created.length });
}
