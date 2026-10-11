import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ledgerEntries, netDebts, fundBalance } from "@/lib/ledger";

/**
 * The household's Money ledger (Sprint 5): every entry, who owes whom with rent
 * included, and the same split by source, for the Money tab (Overview |
 * Activity | Balances). Read-only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const [entries, payments] = await Promise.all([
    ledgerEntries(apartmentId),
    // Recorded payments (Sprint 5c): one line each in Activity; waiting ones need an answer.
    prisma.payment.findMany({ where: { apartmentId, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { createdAt: "asc" } }),
  ]);
  const ids = [...new Set([...entries.flatMap(e => [e.from, e.to]), ...payments.flatMap(p => [p.fromUserId, p.toUserId])])];
  const [users, members] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.apartmentMember.findMany({ where: { apartmentId, status: { not: "MOVED_OUT" } }, select: { userId: true } }),
  ]);
  const current = new Set(members.map(m => m.userId));
  // People who have left still appear in old entries; say so rather than showing a bare name.
  const names = Object.fromEntries(users.map(u => [u.id, current.has(u.id) ? u.name : `${u.name} (moved out)`]));

  return NextResponse.json({
    me: access.userId,
    names,
    entries: entries.map(({ cents, ...e }) => ({ ...e, amount: cents / 100 })),
    debts: netDebts(entries),
    bySource: {
      expense: netDebts(entries.filter(e => e.source === "expense")),
      rent: netDebts(entries.filter(e => e.source === "rent")),
    },
    fundBalance: fundBalance(entries),
    payments: payments.map(p => ({
      id: p.id, from: p.fromUserId, to: p.toUserId, amount: p.amount, method: p.method, note: p.note,
      status: p.status, createdAt: p.createdAt, respondedAt: p.respondedAt,
      items: entries.filter(e => e.paymentId === p.id && (e.kind === "EXPENSE_SHARE" || e.kind === "RENT_SHARE")).map(e => e.label),
    })),
  });
}
