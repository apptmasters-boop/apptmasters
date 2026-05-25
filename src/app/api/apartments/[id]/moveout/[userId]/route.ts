import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: apartmentId, userId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only self or admin can view move-out report
  const requester = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!requester) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (payload.userId !== userId && requester.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [user, membership, rentPayments, expenseSplits, choresCompleted, score] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, moveInDate: true } }),
    prisma.apartmentMember.findFirst({ where: { userId, apartmentId } }),
    prisma.rentPayment.findMany({
      where: { userId, rentCycle: { apartmentId } },
      include: { rentCycle: { select: { month: true, totalAmount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expenseSplit.findMany({
      where: { userId, expense: { apartmentId } },
      include: { expense: { select: { title: true, amount: true, date: true } } },
      orderBy: { expense: { date: "desc" } },
    }),
    prisma.chore.count({ where: { apartmentId, completedById: userId, status: "DONE" } }),
    prisma.roommateScore.findUnique({
      where: { userId_apartmentId: { userId, apartmentId } },
      include: { logs: { orderBy: { createdAt: "desc" } } },
    }),
  ]);

  const totalRentPaid = rentPayments.filter(p => p.status !== "PENDING").reduce((s, p) => s + p.amount, 0);
  const pendingRent = rentPayments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  const totalExpenseOwed = expenseSplits.reduce((s, s2) => s + s2.amount, 0);
  const totalExpensePaid = expenseSplits.filter(s2 => s2.status === "PAID").reduce((s, s2) => s + s2.amount, 0);

  return NextResponse.json({
    user,
    membership,
    summary: {
      totalRentPaid,
      pendingRent,
      choresCompleted,
      totalExpenseOwed,
      totalExpensePaid,
      outstandingBalance: totalExpenseOwed - totalExpensePaid,
    },
    rentPayments,
    expenseSplits,
    score: score ? { score: score.score, logs: score.logs } : { score: 50, logs: [] },
  });
}
