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

  // Simplify debts: net out A→B and B→A
  const simplified: { from: string; to: string; amount: number }[] = [];
  const seen = new Set<string>();
  for (const [fromId, tos] of Object.entries(balances)) {
    for (const [toId, amount] of Object.entries(tos)) {
      const key = [fromId, toId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      const net = amount - (balances[toId]?.[fromId] ?? 0);
      if (net > 0.01) simplified.push({ from: toId, to: fromId, amount: parseFloat(net.toFixed(2)) });
      else if (net < -0.01) simplified.push({ from: fromId, to: toId, amount: parseFloat((-net).toFixed(2)) });
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
