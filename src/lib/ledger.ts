/**
 * The Money ledger (docs/PRODUCT_LOGIC.md §11.2, §22): every source of money
 * in a household turned into one kind of entry, so balances come from a single
 * calculation instead of each module keeping its own.
 *
 *   rent shares + expense shares − payments = what each person owes
 *
 * Built alongside today's Money page (owner's decision, 2026-10-07): it reads
 * the existing tables and writes nothing. `compareWithCurrent` checks it gives
 * the same shared-expense balances as `householdDebts` before anything switches.
 *
 * Amounts are whole cents, so adding many entries never drifts.
 */
import { prisma } from "@/lib/db";
import { householdDebts, type Debt } from "@/lib/balances";

export type EntryKind =
  | "EXPENSE_SHARE" // `from` owes `to` their share of an expense `to` paid
  | "RENT_SHARE"    // `from` owes the rent payer `to` their share of a month's rent
  | "PAYMENT"       // `from` paid `to` (reduces what `from` owes `to`)
  | "MARKED_SETTLED" // an expense marked settled by hand: its unpaid shares count as paid
  | "FUND_IN"       // `from` put money into the shared fund
  | "FUND_OUT";     // `from` took money out of the shared fund

export interface LedgerEntry {
  /** Stable key, e.g. "expense-share:<splitId>". */
  id: string;
  kind: EntryKind;
  source: "expense" | "rent" | "fund";
  /** The expense, rent month or fund movement this comes from. */
  sourceId: string;
  label: string;
  date: Date;
  from: string;
  /** A member's id, or FUND for the shared fund. */
  to: string;
  cents: number;
  /** A payment someone reported that the receiver hasn't confirmed yet: listed, but not counted. */
  pending?: boolean;
}

export const FUND = "FUND";
const toCents = (amount: number) => Math.round(amount * 100);
const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** All ledger entries for one household, oldest first. */
export async function ledgerEntries(apartmentId: string): Promise<LedgerEntry[]> {
  const [expenses, cycles, fundMoves, rentConfig] = await Promise.all([
    prisma.expense.findMany({ where: { apartmentId }, include: { splits: true } }),
    prisma.rentCycle.findMany({ where: { apartmentId }, include: { payments: true } }),
    prisma.fundTransaction.findMany({ where: { apartmentId } }),
    prisma.rentConfig.findUnique({ where: { apartmentId }, select: { dueDay: true } }),
  ]);
  const entries: LedgerEntry[] = [];

  // Settlement rows aren't read: every settlement also marks its splits paid,
  // and those paid splits are the payments below. Counting both would double them.
  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.userId === e.paidById) continue; // your own share of what you paid isn't a debt
      const pair = { source: "expense" as const, sourceId: e.id, from: s.userId, to: e.paidById, cents: toCents(s.amount) };
      entries.push({ ...pair, id: `expense-share:${s.id}`, kind: "EXPENSE_SHARE", label: e.title, date: e.date });
      if (s.status === "PAID") {
        entries.push({ ...pair, id: `expense-paid:${s.id}`, kind: "PAYMENT", label: `Paid for ${e.title}`, date: s.settledAt ?? e.date });
      } else if (e.status === "SETTLED") {
        entries.push({ ...pair, id: `expense-settled:${s.id}`, kind: "MARKED_SETTLED", label: `${e.title} marked as settled`, date: e.date });
      } else if (s.status === "PENDING_CASH") {
        entries.push({ ...pair, id: `expense-cash:${s.id}`, kind: "PAYMENT", label: `Cash for ${e.title} (waiting for confirmation)`, date: s.settledAt ?? e.date, pending: true });
      }
    }
  }

  for (const c of cycles) {
    const due = new Date(`${c.month}-${String(Math.min(rentConfig?.dueDay ?? 1, 28)).padStart(2, "0")}T12:00:00Z`);
    for (const p of c.payments) {
      if (p.userId === c.rentPayerId) continue;
      const pair = { source: "rent" as const, sourceId: c.id, from: p.userId, to: c.rentPayerId, cents: toCents(p.amount) };
      const month = monthLabel(c.month);
      entries.push({ ...pair, id: `rent-share:${p.id}`, kind: "RENT_SHARE", label: `Rent ${month}`, date: due });
      // A roommate marking their rent "paid" counts once the rent payer confirms it (same rule as cash).
      if (p.status === "CONFIRMED") {
        entries.push({ ...pair, id: `rent-paid:${p.id}`, kind: "PAYMENT", label: `Rent ${month} paid`, date: p.confirmedAt ?? p.paidAt ?? due });
      } else if (p.status === "PAID") {
        entries.push({ ...pair, id: `rent-claimed:${p.id}`, kind: "PAYMENT", label: `Rent ${month} (waiting for confirmation)`, date: p.paidAt ?? due, pending: true });
      }
    }
  }

  for (const t of fundMoves) {
    entries.push({
      id: `fund:${t.id}`, kind: t.type === "WITHDRAWAL" ? "FUND_OUT" : "FUND_IN", source: "fund", sourceId: t.id,
      label: t.description, date: t.createdAt, from: t.userId, to: FUND, cents: toCents(t.amount),
    });
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
}

/**
 * Who owes whom after netting each pair, in the same shape as `householdDebts`.
 * Fund entries and payments still waiting for confirmation don't count.
 */
export function netDebts(entries: LedgerEntry[]): Debt[] {
  // owed[a][b] = cents a owes b (can be negative; only the a<b direction is kept).
  const owed = new Map<string, number>();
  const add = (from: string, to: string, cents: number) => {
    const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
    const key = `${a}|${b}`;
    owed.set(key, (owed.get(key) ?? 0) + sign * cents);
  };
  for (const e of entries) {
    if (e.pending || e.source === "fund") continue;
    if (e.kind === "EXPENSE_SHARE" || e.kind === "RENT_SHARE") add(e.from, e.to, e.cents);
    else if (e.kind === "PAYMENT" || e.kind === "MARKED_SETTLED") add(e.from, e.to, -e.cents);
  }
  const debts: Debt[] = [];
  for (const [key, cents] of owed) {
    if (cents === 0) continue;
    const [a, b] = key.split("|");
    debts.push(cents > 0 ? { from: a, to: b, amount: cents / 100 } : { from: b, to: a, amount: -cents / 100 });
  }
  return debts.sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to));
}

/** The shared fund's balance according to its movements, in dollars. */
export const fundBalance = (entries: LedgerEntry[]) =>
  entries.reduce((sum, e) => sum + (e.kind === "FUND_IN" ? e.cents : e.kind === "FUND_OUT" ? -e.cents : 0), 0) / 100;

export interface DebtDifference { from: string; to: string; current: number; ledger: number }

/** Pairs whose amount differs by a cent or more between two lists of debts. */
export function compareDebts(current: Debt[], ledger: Debt[]): DebtDifference[] {
  const signed = (list: Debt[]) => {
    const m = new Map<string, number>();
    for (const d of list) {
      const [a, b, sign] = d.from < d.to ? [d.from, d.to, 1] : [d.to, d.from, -1];
      m.set(`${a}|${b}`, (m.get(`${a}|${b}`) ?? 0) + sign * toCents(d.amount));
    }
    return m;
  };
  const cur = signed(current);
  const led = signed(ledger);
  const diffs: DebtDifference[] = [];
  for (const key of new Set([...cur.keys(), ...led.keys()])) {
    const c = cur.get(key) ?? 0;
    const l = led.get(key) ?? 0;
    if (Math.abs(c - l) < 1) continue;
    const [a, b] = key.split("|");
    // Report in the direction of whichever side says money is owed.
    const flip = (c || l) < 0;
    diffs.push(flip ? { from: b, to: a, current: -c / 100, ledger: -l / 100 } : { from: a, to: b, current: c / 100, ledger: l / 100 });
  }
  return diffs;
}

/**
 * Money check for one household (Sprint 5a): does the ledger agree with
 * today's Money page, and what does it add (rent)?
 */
export async function compareWithCurrent(apartmentId: string) {
  const [current, entries, fund] = await Promise.all([
    householdDebts(apartmentId),
    ledgerEntries(apartmentId),
    prisma.apartmentFund.findUnique({ where: { apartmentId }, select: { balance: true } }),
  ]);
  const expenseDifferences = compareDebts(current, netDebts(entries.filter(e => e.source === "expense")));
  const fundFromMoves = fundBalance(entries);
  return {
    expensesMatch: expenseDifferences.length === 0,
    expenseDifferences,
    /** Rent still owed, which today's Money page leaves out (§12.2). */
    rentOwed: netDebts(entries.filter(e => e.source === "rent")),
    /** Everything together: what the new Money page will show. */
    allDebts: netDebts(entries),
    fund: { stored: fund?.balance ?? 0, fromMovements: fundFromMoves, matches: toCents(fund?.balance ?? 0) === toCents(fundFromMoves) },
    counts: {
      expenseShares: entries.filter(e => e.kind === "EXPENSE_SHARE").length,
      rentShares: entries.filter(e => e.kind === "RENT_SHARE").length,
      waitingForConfirmation: entries.filter(e => e.pending).length,
    },
  };
}
