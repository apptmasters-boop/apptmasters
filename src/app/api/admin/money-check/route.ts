import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compareWithCurrent } from "@/lib/ledger";

/**
 * Admin → Money check (Sprint 5a): for every household, does the new ledger
 * give the same shared-expense balances as today's Money page, and what rent
 * is still owed? Site admins only.
 */
export async function GET(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apartments = await prisma.apartment.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, members: { select: { user: { select: { id: true, name: true } } } } },
  });

  const households = [];
  for (const apt of apartments) { // one at a time: a small server, and this is a rare admin check
    const check = await compareWithCurrent(apt.id);
    const names: Record<string, string> = Object.fromEntries(apt.members.map(m => [m.user.id, m.user.name]));
    const missing = [...new Set([...check.expenseDifferences, ...check.rentOwed].flatMap(d => [d.from, d.to]))].filter(id => !names[id]);
    if (missing.length) {
      for (const u of await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })) names[u.id] = `${u.name} (moved out)`;
    }
    const who = (id: string) => names[id] ?? "Former member";
    households.push({
      id: apt.id,
      name: apt.name,
      expensesMatch: check.expensesMatch,
      expenseDifferences: check.expenseDifferences.map(d => ({ ...d, fromName: who(d.from), toName: who(d.to) })),
      rentOwed: check.rentOwed.map(d => ({ ...d, fromName: who(d.from), toName: who(d.to) })),
      fund: check.fund,
      counts: check.counts,
    });
  }

  return NextResponse.json({
    checkedAt: new Date(),
    allExpensesMatch: households.every(h => h.expensesMatch),
    households,
  });
}
