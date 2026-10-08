/**
 * Who owes whom in shared expenses (not rent yet; that joins in Sprint 5's
 * ledger). Used by the balance API and the Home feed so both show the same
 * numbers.
 */
import { prisma } from "@/lib/db";

export interface Debt { from: string; to: string; amount: number }

/** Net debts between members from unsettled expense splits, one entry per pair. */
export async function householdDebts(apartmentId: string): Promise<Debt[]> {
  const expenses = await prisma.expense.findMany({
    where: { apartmentId, status: { not: "SETTLED" } },
    include: { splits: true },
  });

  // balances[A][B] > 0: B owes A; < 0: A owes B. Mirror entries are kept equal and opposite.
  const balances: Record<string, Record<string, number>> = {};
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.status === "PAID") continue;
      const owerId = split.userId;
      const payeeId = expense.paidById;
      if (owerId === payeeId) continue;
      balances[owerId] ??= {};
      balances[payeeId] ??= {};
      balances[owerId][payeeId] = (balances[owerId][payeeId] ?? 0) - split.amount;
      balances[payeeId][owerId] = (balances[payeeId][owerId] ?? 0) + split.amount;
    }
  }

  // Each pair once; the amount is already net, so don't subtract the mirror entry.
  const debts: Debt[] = [];
  const seen = new Set<string>();
  for (const [fromId, tos] of Object.entries(balances)) {
    for (const [toId, amount] of Object.entries(tos)) {
      const key = [fromId, toId].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      if (amount > 0.01) debts.push({ from: toId, to: fromId, amount: parseFloat(amount.toFixed(2)) });
      else if (amount < -0.01) debts.push({ from: fromId, to: toId, amount: parseFloat((-amount).toFixed(2)) });
    }
  }
  return debts;
}

/** Total that `userId` owes other members in shared expenses. */
export const totalOwedBy = (debts: Debt[], userId: string) =>
  parseFloat(debts.filter(d => d.from === userId).reduce((s, d) => s + d.amount, 0).toFixed(2));
