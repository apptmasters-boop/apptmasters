/**
 * What the ledger means for one person (PRODUCT_LOGIC §11.1): what they owe,
 * what they're owed, their unpaid rent, and payments waiting for them to
 * confirm. Pure functions with no database access, shared by the Money tab
 * (in the browser) and the Home feed (on the server) so both show the same
 * numbers.
 */

export interface Debt { from: string; to: string; amount: number }
export interface SummaryEntry {
  id: string; kind: string; source: string; label: string;
  from: string; to: string; amount: number; date: string | Date; pending?: boolean;
  /** Part of a recorded payment (Sprint 5c); that payment is answered as a whole. */
  paymentId?: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Total `me` owes others, and total others owe `me`, after netting each pair. */
export function position(debts: Debt[], me: string) {
  return {
    owe: round(debts.filter(d => d.from === me).reduce((s, d) => s + d.amount, 0)),
    owed: round(debts.filter(d => d.to === me).reduce((s, d) => s + d.amount, 0)),
  };
}

/** Net for one source: positive = `me` owes, negative = `me` is owed. */
export function net(debts: Debt[], me: string) {
  const { owe, owed } = position(debts, me);
  return round(owe - owed);
}

export interface RentShare { id: string; label: string; amount: number; due: Date; to: string; waiting: boolean }

/**
 * `me`'s rent shares that aren't confirmed yet, earliest first. `waiting` means
 * they marked it paid and the rent payer hasn't confirmed.
 */
export function unpaidRent(entries: SummaryEntry[], me: string): RentShare[] {
  const settled = new Set<string>();
  const waiting = new Set<string>();
  for (const e of entries) {
    if (e.kind !== "PAYMENT" || e.source !== "rent") continue;
    const shareId = e.id.slice(e.id.indexOf(":") + 1);
    (e.pending ? waiting : settled).add(shareId);
  }
  return entries
    .filter(e => e.kind === "RENT_SHARE" && e.from === me)
    .map(e => ({ e, shareId: e.id.slice(e.id.indexOf(":") + 1) }))
    .filter(({ shareId }) => !settled.has(shareId))
    .map(({ e, shareId }) => ({ id: e.id, label: e.label, amount: e.amount, due: new Date(e.date), to: e.to, waiting: waiting.has(shareId) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

/**
 * Single items others reported paying `me` (old cash and rent confirmations)
 * that `me` still has to confirm. Recorded payments are answered as a whole,
 * so their items aren't listed here.
 */
export const toConfirm = (entries: SummaryEntry[], me: string) =>
  entries.filter(e => e.kind === "PAYMENT" && e.pending && e.to === me && !e.paymentId);
