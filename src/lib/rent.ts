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
import { notify } from "@/lib/notify";

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
 *
 * With "rotate the rent payer" on, a new month goes to the person after last
 * month's rent payer (in the order people joined), unless an admin has picked
 * someone else since.
 */
export async function startRentMonth(apartmentId: string, month: string) {
  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  if (!config?.rentPayerId) throw new RentError("Set up rent and choose a rent payer first");
  const existing = await prisma.rentCycle.findUnique({ where: { apartmentId_month: { apartmentId, month } } });
  if (existing) return { cycle: existing, created: false };

  const shares: Record<string, number> = JSON.parse(config.shares || "{}");
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  const order = members.map(m => m.userId);

  let rentPayerId = config.rentPayerId;
  if (config.autoRotate) {
    const previous = await prisma.rentCycle.findFirst({ where: { apartmentId, month: { lt: month } }, orderBy: { month: "desc" } });
    const at = previous && previous.rentPayerId === config.rentPayerId ? order.indexOf(previous.rentPayerId) : -1;
    if (at >= 0 && order.length > 1) rentPayerId = order[(at + 1) % order.length];
  }

  const roommates = order.filter(id => id !== rentPayerId);
  const equalShare = parseFloat((config.totalAmount / (roommates.length + 1)).toFixed(2));
  try {
    const cycle = await prisma.rentCycle.create({
      data: {
        apartmentId, month, rentPayerId, totalAmount: config.totalAmount,
        payments: { create: roommates.map(userId => ({ userId, amount: shares[userId] ?? equalShare })) },
      },
    });
    // The setup always shows who pays the landlord now.
    if (rentPayerId !== config.rentPayerId) await prisma.rentConfig.update({ where: { apartmentId }, data: { rentPayerId } });
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

// ---------------------------------------------------------------------------
// Rent that runs by itself (Sprint 7b, §22: "rent share becomes due → Money
// balance; reminder eligibility; Home priority").

const DAY = 86_400_000;
/** A month starts this many days before its due day… */
export const START_DAYS_BEFORE = 3;
/** …and can still start this many days after it (in case nobody opened the app). Older months never start by themselves. */
export const START_DAYS_AFTER = 7;
/** Automatic reminders, in days after the due day (0 = the due day itself). */
export const REMINDER_DAYS = [0, 3, 10];

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 15)).toISOString().slice(0, 7);
};
const shortDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const usd = (n: number) => `$${n.toFixed(2)}`;

/** The months (YYYY-MM) whose rent is coming due right now: between 3 days before and 7 days after their due day. */
export function monthsComingDue(dueDay: number, now = new Date()): string[] {
  const here = currentMonth(now);
  return [shiftMonth(here, -1), here, shiftMonth(here, 1)].filter(month => {
    const due = rentDueDate(month, dueDay).getTime();
    return now.getTime() >= due - START_DAYS_BEFORE * DAY && now.getTime() < due + (START_DAYS_AFTER + 1) * DAY;
  });
}

/** The day a month's rent starts by itself (YYYY-MM-DD). */
export const startsOn = (month: string, dueDay: number) =>
  new Date(rentDueDate(month, dueDay).getTime() - START_DAYS_BEFORE * DAY).toISOString().slice(0, 10);

/**
 * Starts the month whose rent is coming due, if nobody has yet, and tells the
 * household. Called by the daily job and when someone opens Rent, Money or
 * Home, so it's on time even if the job didn't run. Returns the months it started.
 */
export async function ensureRentMonths(apartmentId: string, now = new Date()) {
  const config = await prisma.rentConfig.findUnique({ where: { apartmentId }, select: { dueDay: true, rentPayerId: true } });
  if (!config?.rentPayerId) return [];
  const started: string[] = [];
  for (const month of monthsComingDue(config.dueDay, now)) {
    const exists = await prisma.rentCycle.findUnique({ where: { apartmentId_month: { apartmentId, month } }, select: { id: true } });
    if (exists) continue;
    const { cycle, created } = await startRentMonth(apartmentId, month);
    if (created) {
      await announceRentMonth(cycle.id, now);
      started.push(month);
    }
  }
  return started;
}

/** Tells roommates their share and due date, and the rent payer to pay the landlord, when a month starts. */
export async function announceRentMonth(cycleId: string, now = new Date()) {
  const cycle = await prisma.rentCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { payments: true, rentPayer: { select: { id: true, name: true } }, apartment: { select: { rentConfig: { select: { dueDay: true, landlordName: true } } } } },
  });
  const config = cycle.apartment.rentConfig;
  const due = shortDay(rentDueDate(cycle.month, config?.dueDay ?? 1));
  const name = monthLabel(cycle.month).split(" ")[0];
  const link = `/apartment/${cycle.apartmentId}/rent`;
  for (const p of cycle.payments) {
    await notify({
      apartmentId: cycle.apartmentId, userIds: [p.userId], type: "RENT_REMINDER", link, at: now,
      title: `${name}'s rent: your share is ${usd(p.amount)}`,
      body: `Due ${due}. Pay ${cycle.rentPayer.name}, then mark it paid in Money → Rent.`,
    });
  }
  await notify({
    apartmentId: cycle.apartmentId, userIds: [cycle.rentPayer.id], type: "RENT_REMINDER", link, at: now,
    title: `${name}'s rent has started`,
    body: `Pay the landlord${config?.landlordName ? ` (${config.landlordName})` : ""} ${usd(cycle.totalAmount)} by ${due}, then tap "I paid the landlord" in Money → Rent.`,
  });
}

/** At most one rent reminder per person per household per day. */
async function remindedRecently(userId: string, apartmentId: string, now: Date) {
  return (await prisma.notification.count({
    where: { userId, apartmentId, type: "RENT_REMINDER", createdAt: { gte: new Date(now.getTime() - 20 * 3_600_000) } },
  })) > 0;
}

/**
 * The daily rent job: start the months coming due, then remind, on the due day
 * and 3 and 10 days after it, roommates who haven't paid and the rent payer
 * while the landlord isn't marked paid. `onlyHouseholds` limits it to some
 * households (tests use it so they don't touch each other's data).
 */
export async function runRentAutomation(now = new Date(), onlyHouseholds?: string[]) {
  const configs = await prisma.rentConfig.findMany({
    where: { rentPayerId: { not: null }, ...(onlyHouseholds ? { apartmentId: { in: onlyHouseholds } } : {}) },
    select: { apartmentId: true, dueDay: true },
  });
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let started = 0;
  let reminded = 0;

  for (const config of configs) {
    started += (await ensureRentMonths(config.apartmentId, now)).length;
    const here = currentMonth(now);
    const cycles = await prisma.rentCycle.findMany({
      where: { apartmentId: config.apartmentId, month: { in: [shiftMonth(here, -1), here] } },
      include: { payments: { where: { status: "PENDING" } }, rentPayer: { select: { id: true, name: true } } },
    });
    for (const cycle of cycles) {
      const dueAt = rentDueDate(cycle.month, config.dueDay);
      const daysLate = Math.round((today - dueAt.getTime()) / DAY);
      if (!REMINDER_DAYS.includes(daysLate)) continue;
      const name = monthLabel(cycle.month).split(" ")[0];
      const link = `/apartment/${config.apartmentId}/rent`;
      const when = daysLate === 0 ? "is due today" : `was due ${shortDay(dueAt)}, ${daysLate} days ago`;

      for (const p of cycle.payments) {
        if (await remindedRecently(p.userId, config.apartmentId, now)) continue;
        await notify({
          apartmentId: config.apartmentId, userIds: [p.userId], type: "RENT_REMINDER", link, sendEmailTo: [p.userId], at: now, important: true,
          title: daysLate === 0 ? "Rent due today" : "Your rent share is late",
          body: `Your ${name} rent share of ${usd(p.amount)} to ${cycle.rentPayer.name} ${when}. Mark it paid in Money → Rent once you've paid.`,
        });
        reminded++;
      }
      if (!cycle.markedPaidAt && !(await remindedRecently(cycle.rentPayer.id, config.apartmentId, now))) {
        await notify({
          apartmentId: config.apartmentId, userIds: [cycle.rentPayer.id], type: "RENT_REMINDER", link, sendEmailTo: [cycle.rentPayer.id], at: now, important: true,
          title: daysLate === 0 ? "Pay the landlord today" : "The landlord isn't marked paid yet",
          body: `${name}'s rent of ${usd(cycle.totalAmount)} ${when}. Tap "I paid the landlord" in Money → Rent once you have.`,
        });
        reminded++;
      }
    }
  }
  return { started, reminded };
}
