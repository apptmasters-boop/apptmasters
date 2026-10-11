/**
 * Record a payment (docs/PRODUCT_LOGIC.md §13.2, Sprint 5c).
 *
 * One payment from one member to another covers items the payer owes that
 * person: shared-expense shares and rent shares. Items the receiver owes the
 * payer can be included to offset it. The payment never replaces those items:
 *
 *   record   → the payer's items wait for confirmation (cash split PENDING_CASH,
 *              rent PAID), the same states the old pages use, so every page agrees
 *   confirm  → every covered item is paid (split PAID, rent CONFIRMED)
 *   decline / cancel → every item goes back to how it was
 *
 * Because only the items' states change, the ledger and the Money check keep
 * reading the same facts. Nothing is deleted.
 */
import { prisma } from "@/lib/db";
import { adjustScore } from "@/lib/score";

export const PAYMENT_METHODS = ["CASH", "BANK", "VENMO", "ZELLE", "CASHAPP", "PAYPAL", "OTHER"] as const;

export interface OpenItem { type: "expense" | "rent"; id: string; label: string; amount: number; date: Date }

const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Unpaid items `debtor` owes `creditor`, not already part of a payment, oldest first. */
async function owedItems(apartmentId: string, debtor: string, creditor: string): Promise<OpenItem[]> {
  const [splits, rent] = await Promise.all([
    prisma.expenseSplit.findMany({
      where: { userId: debtor, status: "PENDING", paymentId: null, expense: { apartmentId, paidById: creditor, status: { not: "SETTLED" } } },
      include: { expense: { select: { title: true, date: true } } },
    }),
    prisma.rentPayment.findMany({
      where: { userId: debtor, status: "PENDING", paymentId: null, rentCycle: { apartmentId, rentPayerId: creditor } },
      include: { rentCycle: { select: { month: true } } },
    }),
  ]);
  return [
    ...splits.map(s => ({ type: "expense" as const, id: s.id, label: s.expense.title, amount: s.amount, date: s.expense.date })),
    ...rent.map(r => ({ type: "rent" as const, id: r.id, label: `Rent ${monthLabel(r.rentCycle.month)}`, amount: r.amount, date: new Date(`${r.rentCycle.month}-01T12:00:00Z`) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** What `me` could pay `other` now, and what `other` owes `me` that can offset it. */
export async function openItems(apartmentId: string, me: string, other: string) {
  const [owe, offset] = await Promise.all([owedItems(apartmentId, me, other), owedItems(apartmentId, other, me)]);
  return { owe, offset };
}

export class PaymentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const cents = (n: number) => Math.round(n * 100);

/**
 * Records a payment from `fromId` to `toId` covering the chosen items. Every
 * chosen item must be one `openItems` lists right now; the total is what's
 * covered minus what's offset, and must be more than zero.
 */
export async function recordPayment(apartmentId: string, fromId: string, toId: string, choice: {
  owe: { type: "expense" | "rent"; id: string }[];
  offset?: { type: "expense" | "rent"; id: string }[];
  method: string; note?: string | null;
}) {
  if (fromId === toId) throw new PaymentError("You can't pay yourself");
  if (!(PAYMENT_METHODS as readonly string[]).includes(choice.method)) throw new PaymentError("Choose how you paid");
  const { owe, offset } = await openItems(apartmentId, fromId, toId);
  const pick = (list: OpenItem[], wanted: { type: string; id: string }[]) => {
    const chosen = wanted.map(w => list.find(i => i.type === w.type && i.id === w.id));
    if (chosen.some(i => !i) || new Set(wanted.map(w => w.id)).size !== wanted.length) {
      throw new PaymentError("Some of these items are no longer owed. Refresh and try again.", 409);
    }
    return chosen as OpenItem[];
  };
  const paying = pick(owe, choice.owe);
  const offsetting = pick(offset, choice.offset ?? []);
  if (paying.length === 0) throw new PaymentError("Choose at least one thing you're paying for");
  const totalCents = paying.reduce((s, i) => s + cents(i.amount), 0) - offsetting.reduce((s, i) => s + cents(i.amount), 0);
  if (totalCents <= 0) throw new PaymentError("They owe you at least as much as this. Nothing to pay.");

  const ids = (items: OpenItem[], type: "expense" | "rent") => items.filter(i => i.type === type).map(i => i.id);
  const now = new Date();
  return prisma.$transaction(async tx => {
    const payment = await tx.payment.create({
      data: { apartmentId, fromUserId: fromId, toUserId: toId, amount: totalCents / 100, method: choice.method, note: choice.note?.trim().slice(0, 300) || null },
    });
    // The payer's items wait for confirmation; the receiver's offset items are only linked.
    // Each update checks the item is still unpaid and unclaimed, so two payments can't take the same item.
    const updates = [
      tx.expenseSplit.updateMany({ where: { id: { in: ids(paying, "expense") }, status: "PENDING", paymentId: null }, data: { status: "PENDING_CASH", paymentId: payment.id } }),
      tx.rentPayment.updateMany({ where: { id: { in: ids(paying, "rent") }, status: "PENDING", paymentId: null }, data: { status: "PAID", paidAt: now, method: choice.method, paymentId: payment.id } }),
      tx.expenseSplit.updateMany({ where: { id: { in: ids(offsetting, "expense") }, status: "PENDING", paymentId: null }, data: { paymentId: payment.id } }),
      tx.rentPayment.updateMany({ where: { id: { in: ids(offsetting, "rent") }, status: "PENDING", paymentId: null }, data: { paymentId: payment.id } }),
    ];
    const counts = await Promise.all(updates);
    if (counts.reduce((s, c) => s + c.count, 0) !== paying.length + offsetting.length) {
      throw new PaymentError("Some of these items changed meanwhile. Refresh and try again.", 409);
    }
    return payment;
  });
}

/**
 * Confirm (receiver), decline (receiver) or cancel (payer) a waiting payment.
 * Returns the payment as it is afterwards.
 */
export async function respondToPayment(apartmentId: string, paymentId: string, userId: string, action: "confirm" | "decline" | "cancel") {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, apartmentId } });
  if (!payment) throw new PaymentError("Payment not found", 404);
  if (payment.status !== "PENDING") throw new PaymentError("This payment has already been answered", 409);
  const allowed = action === "cancel" ? payment.fromUserId === userId : payment.toUserId === userId;
  if (!allowed) {
    throw new PaymentError(action === "cancel" ? "Only the person who paid can cancel it" : "Only the person who was paid can answer this", 403);
  }

  const now = new Date();
  const confirmedRent = await prisma.$transaction(async tx => {
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: action === "confirm" ? "CONFIRMED" : action === "decline" ? "DECLINED" : "CANCELLED", respondedAt: now },
    });
    if (count === 0) throw new PaymentError("This payment has already been answered", 409);

    if (action !== "confirm") {
      // Back to how they were before the payment was recorded.
      await tx.expenseSplit.updateMany({ where: { paymentId: payment.id, status: "PENDING_CASH" }, data: { status: "PENDING" } });
      await tx.rentPayment.updateMany({ where: { paymentId: payment.id, status: "PAID" }, data: { status: "PENDING", paidAt: null, method: null } });
      await tx.expenseSplit.updateMany({ where: { paymentId: payment.id }, data: { paymentId: null } });
      await tx.rentPayment.updateMany({ where: { paymentId: payment.id }, data: { paymentId: null } });
      return [];
    }

    // Items someone already settled another way (e.g. the old cash confirmation) stay as they are.
    const splits = await tx.expenseSplit.findMany({ where: { paymentId: payment.id, status: { in: ["PENDING", "PENDING_CASH"] } }, select: { id: true, expenseId: true } });
    await tx.expenseSplit.updateMany({ where: { id: { in: splits.map(s => s.id) } }, data: { status: "PAID", settledAt: now } });
    const rent = await tx.rentPayment.findMany({ where: { paymentId: payment.id, status: { in: ["PENDING", "PAID"] } }, select: { id: true, userId: true } });
    await tx.rentPayment.updateMany({ where: { id: { in: rent.map(r => r.id) } }, data: { status: "CONFIRMED", confirmedAt: now } });

    // An expense whose shares are now all paid is settled, as on the old Shared expenses page.
    for (const expenseId of new Set(splits.map(s => s.expenseId))) {
      const unpaid = await tx.expenseSplit.count({ where: { expenseId, status: { not: "PAID" } } });
      if (unpaid === 0) await tx.expense.update({ where: { id: expenseId }, data: { status: "SETTLED" } });
    }
    // Kept for the old Shared expenses history; the ledger reads the items, not this row.
    await tx.settlement.create({
      data: { apartmentId, fromUserId: payment.fromUserId, toUserId: payment.toUserId, amount: payment.amount, method: payment.method, notes: payment.note, confirmedAt: now },
    });
    return rent;
  });

  // Same reward as confirming rent on the Rent page.
  for (const r of confirmedRent) await adjustScore(r.userId, apartmentId, 5, "Rent payment confirmed").catch(() => {});
  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}
