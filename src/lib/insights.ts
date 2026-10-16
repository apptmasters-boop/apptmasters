/**
 * Insights (docs/PRODUCT_LOGIC.md §19): household numbers aggregated from the
 * same sources as the rest of the app, never a separate calculation:
 *
 *   spending       Expense rows (shopping trips' grocery expenses included)
 *   a person's share   their split; for what they paid, the amount minus the
 *                  others' shares (the payer's own split is stored as 0)
 *   rent           the monthly summaries of src/lib/rent.ts, as on Money → Rent
 *   who owes whom  the Money ledger (src/lib/ledger.ts), as on Money → Balances
 *   household      cleanings, shopping trips and chores
 *
 * Replaces the separate Stats and Analytics pages (Sprint 10b).
 */
import { prisma } from "@/lib/db";
import { ledgerEntries, netDebts } from "@/lib/ledger";
import { rentMonths } from "@/lib/rent";

const DAY = 86_400_000;
const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;
const monthOf = (d: Date) => d.toISOString().slice(0, 7);

/** `person`'s share of an expense, in cents. */
function shareOf(expense: { amount: number; paidById: string; splits: { userId: string; amount: number }[] }, person: string) {
  if (expense.paidById === person) {
    const others = expense.splits.filter(s => s.userId !== person).reduce((s, x) => s + cents(x.amount), 0);
    return Math.max(0, cents(expense.amount) - others);
  }
  return cents(expense.splits.find(s => s.userId === person)?.amount ?? 0);
}

export async function householdInsights(apartmentId: string, userId: string, now = new Date()) {
  // The last 6 months, this one included (UTC months, like the rest of the app).
  const months = Array.from({ length: 6 }, (_, k) => monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + k, 15))));
  const from = new Date(`${months[0]}-01T00:00:00Z`);
  const since = new Date(now.getTime() - 90 * DAY); // household numbers: the last 3 months

  const [expenses, members, rentConfig, entries, cleanings, trips, chores] = await Promise.all([
    prisma.expense.findMany({ where: { apartmentId, date: { gte: from } }, include: { splits: { select: { userId: true, amount: true } } } }),
    prisma.apartmentMember.findMany({ where: { apartmentId, status: { not: "MOVED_OUT" }, role: { not: "GUEST" } }, orderBy: { joinedAt: "asc" }, select: { user: { select: { id: true, name: true } } } }),
    prisma.rentConfig.findUnique({ where: { apartmentId }, select: { dueDay: true } }),
    ledgerEntries(apartmentId),
    prisma.cleaningLog.findMany({ where: { apartmentId, cleanedAt: { gte: since } }, select: { cleanedById: true } }),
    prisma.shoppingTrip.findMany({ where: { apartmentId, status: "COMPLETED", endedAt: { gte: since } }, select: { shopperId: true, totalAmount: true } }),
    prisma.chore.findMany({ where: { apartmentId }, select: { status: true, completedAt: true, completedById: true, assignedUserId: true, dueDate: true } }),
  ]);
  const people = members.map(m => m.user);

  // Money: by month, by category, and a person's share.
  const byMonth = months.map(month => {
    const inMonth = expenses.filter(e => monthOf(e.date) === month);
    return {
      month,
      label: new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      total: dollars(inMonth.reduce((s, e) => s + cents(e.amount), 0)),
      mine: dollars(inMonth.reduce((s, e) => s + shareOf(e, userId), 0)),
    };
  });
  const categoryTotals = new Map<string, number>();
  for (const e of expenses) categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + cents(e.amount));
  const categories = [...categoryTotals].map(([category, c]) => ({ category, total: dollars(c) })).sort((a, b) => b.total - a.total);

  // Rent: the same monthly summaries as Money → Rent, for these months.
  const rent = rentConfig
    ? (await rentMonths(apartmentId, rentConfig.dueDay, now)).filter(m => months.includes(m.month)).map(m => ({
      month: m.month, label: m.label, totalAmount: m.totalAmount, expected: m.expected, collected: m.collected,
      stillToCollect: m.stillToCollect, landlordPaid: !!m.landlordPaidAt,
    }))
    : [];

  // Who owes whom now, from the ledger (rent included), as on Money → Balances.
  const names = new Map<string, string>(people.map(p => [p.id, p.name]));
  const missing = [...new Set(entries.flatMap(e => [e.from, e.to]))].filter(id => !names.has(id) && id !== "FUND");
  if (missing.length) {
    for (const u of await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })) names.set(u.id, `${u.name} (moved out)`);
  }
  const debts = netDebts(entries).map(d => ({ ...d, fromName: names.get(d.from) ?? "Someone", toName: names.get(d.to) ?? "Someone" }));

  // Per person: money over 6 months, household over 3 months.
  const perPerson = people.map(p => ({
    userId: p.id,
    name: p.name,
    paid: dollars(expenses.filter(e => e.paidById === p.id).reduce((s, e) => s + cents(e.amount), 0)),
    share: dollars(expenses.reduce((s, e) => s + shareOf(e, p.id), 0)),
    cleanings: cleanings.filter(c => c.cleanedById === p.id).length,
    trips: trips.filter(t => t.shopperId === p.id).length,
    tripsTotal: dollars(trips.filter(t => t.shopperId === p.id).reduce((s, t) => s + cents(t.totalAmount ?? 0), 0)),
    choresDone: chores.filter(c => c.status === "DONE" && c.completedById === p.id && c.completedAt && c.completedAt >= since).length,
    choresToDo: chores.filter(c => c.status === "PENDING" && c.assignedUserId === p.id).length,
    choresOverdue: chores.filter(c => c.status === "PENDING" && c.assignedUserId === p.id && c.dueDate && c.dueDate < now).length,
  }));

  const thisMonth = byMonth[byMonth.length - 1];
  return {
    months: byMonth,
    categories,
    totals: { sixMonths: dollars(byMonth.reduce((s, m) => s + cents(m.total), 0)), thisMonth: thisMonth.total, mineThisMonth: thisMonth.mine },
    rent,
    debts,
    people: perPerson,
  };
}
