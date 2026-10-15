/**
 * Rent rules (docs/PRODUCT_LOGIC.md §12). Two separate facts per month:
 *
 *   Landlord payment     did the rent payer pay the landlord?   (RentCycle.markedPaidAt)
 *   Household collection did each roommate pay back the rent payer? (RentPayment per roommate)
 *
 * The landlord can be paid while roommates still owe their share, and the
 * other way round. What roommates owe also feeds the Money ledger.
 */
import { prisma } from "@/lib/db";

/** The due date of a month's rent (YYYY-MM), at UTC midnight; a due day past the month's end falls on its last day. */
export function rentDueDate(month: string, dueDay: number): Date {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(dueDay, lastDay)));
}

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** The current month as YYYY-MM (UTC, like the months already stored). */
export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);

export class RentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/**
 * Starts a month's rent: one share per roommate (everyone who shares costs
 * except the rent payer), from the custom shares in the setup or else equal
 * with the rent payer. Starting a month doesn't mark the landlord paid.
 * Starting a month that already exists returns it unchanged.
 */
export async function startRentMonth(apartmentId: string, month: string) {
  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  if (!config?.rentPayerId) throw new RentError("Set up rent and choose a rent payer first");
  const existing = await prisma.rentCycle.findUnique({ where: { apartmentId_month: { apartmentId, month } } });
  if (existing) return { cycle: existing, created: false };

  const shares: Record<string, number> = JSON.parse(config.shares || "{}");
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    select: { userId: true },
  });
  const roommates = members.map(m => m.userId).filter(id => id !== config.rentPayerId);
  const equalShare = parseFloat((config.totalAmount / (roommates.length + 1)).toFixed(2));
  try {
    const cycle = await prisma.rentCycle.create({
      data: {
        apartmentId, month, rentPayerId: config.rentPayerId, totalAmount: config.totalAmount,
        payments: { create: roommates.map(userId => ({ userId, amount: shares[userId] ?? equalShare })) },
      },
    });
    return { cycle, created: true };
  } catch (e) {
    // Started by someone else at the same moment: one month exists once.
    if ((e as { code?: string }).code === "P2002") {
      return { cycle: await prisma.rentCycle.findUniqueOrThrow({ where: { apartmentId_month: { apartmentId, month } } }), created: false };
    }
    throw e;
  }
}

const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;

export interface RentMonthSummary {
  id: string; month: string; label: string;
  /** Due date as YYYY-MM-DD, so every time zone shows the same day. */
  due: string;
  /** The due date has passed. */
  late: boolean;
  totalAmount: number;
  rentPayer: { id: string; name: string };
  /** Landlord payment (§12.1): when the rent payer marked it, or null. */
  landlordPaidAt: Date | null;
  /** The rent payer's own part of the rent: the total minus the roommates' shares. */
  payerShare: number;
  /** What roommates owe the rent payer this month, and how much of it has been confirmed. */
  expected: number; collected: number;
  /** Marked paid by roommates, waiting for the rent payer to confirm. */
  waiting: number;
  stillToCollect: number;
  members: { paymentId: string; userId: string; name: string; amount: number; status: string; method: string | null; paidAt: Date | null; confirmedAt: Date | null }[];
}

type CycleWithPeople = {
  id: string; month: string; totalAmount: number; markedPaidAt: Date | null;
  rentPayer: { id: string; name: string };
  payments: { id: string; userId: string; amount: number; status: string; method: string | null; paidAt: Date | null; confirmedAt: Date | null; user: { name: string } }[];
};

/** The monthly summary of §12.2 for one month. */
export function summarizeMonth(cycle: CycleWithPeople, dueDay: number, now = new Date()): RentMonthSummary {
  const due = rentDueDate(cycle.month, dueDay);
  const sum = (status?: string) => cycle.payments.filter(p => !status || p.status === status).reduce((s, p) => s + cents(p.amount), 0);
  const expected = sum();
  const collected = sum("CONFIRMED");
  return {
    id: cycle.id, month: cycle.month, label: monthLabel(cycle.month),
    due: due.toISOString().slice(0, 10),
    late: now.getTime() >= due.getTime() + 86_400_000,
    totalAmount: cycle.totalAmount,
    rentPayer: cycle.rentPayer,
    landlordPaidAt: cycle.markedPaidAt,
    payerShare: dollars(cents(cycle.totalAmount) - expected),
    expected: dollars(expected), collected: dollars(collected), waiting: dollars(sum("PAID")),
    stillToCollect: dollars(expected - collected),
    members: cycle.payments.map(p => ({
      paymentId: p.id, userId: p.userId, name: p.user.name, amount: p.amount,
      status: p.status, method: p.method, paidAt: p.paidAt, confirmedAt: p.confirmedAt,
    })),
  };
}

/** Every month of a household's rent, newest first, summarized. */
export async function rentMonths(apartmentId: string, dueDay: number, now = new Date()) {
  const cycles = await prisma.rentCycle.findMany({
    where: { apartmentId },
    orderBy: { month: "desc" },
    include: {
      rentPayer: { select: { id: true, name: true } },
      payments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  return cycles.map(c => summarizeMonth(c, dueDay, now));
}
