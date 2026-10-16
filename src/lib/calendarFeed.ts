/**
 * The household calendar's generated entries (docs/PRODUCT_LOGIC.md §15):
 * dates other modules already know, so nobody types them in twice. They are
 * computed when the calendar is read, never stored, and can't be edited on
 * the calendar; each links to the page where it's handled.
 *
 *   Rent due        each month (src/lib/rent.ts)
 *   Cleaning        upcoming turns and recent cleanings (src/lib/rotation.ts)
 *   Shopping        trips done, and whose turn it is now (src/lib/shopping.ts)
 *   Away            members' travel
 *   Moving in       a new member's move-in day (Home Setup)
 *   Chores          pending chores with a due date
 *
 * Household events and repair visits are stored CalendarEvent rows and are
 * not repeated here.
 */
import { prisma } from "@/lib/db";
import { rentDueDate, rentMonths, monthLabel, currentMonth } from "@/lib/rent";
import { upcomingTurns, type TravelSpan } from "@/lib/rotation";
import { notMovedInSpan } from "@/lib/away";
import { shoppingTurn } from "@/lib/shopping";

export interface GeneratedEntry {
  id: string;
  type: "RENT" | "CLEANING" | "SHOPPING" | "TRAVEL" | "CHORE" | "EVENT";
  title: string;
  /** All-day entries sit at noon UTC so every time zone shows the same day. */
  startDate: string;
  endDate: string | null;
  allDay: true;
  notes: string | null;
  /** Where it's handled. */
  href: string;
  auto: true;
}

const DAY = 86_400_000;
const noon = (d: Date) => `${d.toISOString().slice(0, 10)}T12:00:00.000Z`;
const usd = (n: number) => `$${n.toFixed(2)}`;
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 15)).toISOString().slice(0, 7);
};

/** Generated entries from `now` − 60 days to `now` + 120 days. */
export async function generatedEntries(apartmentId: string, now = new Date()): Promise<GeneratedEntry[]> {
  const from = new Date(now.getTime() - 60 * DAY);
  const to = new Date(now.getTime() + 120 * DAY);
  const base = `/apartment/${apartmentId}`;
  const inRange = (d: Date) => d >= from && d <= to;
  const entries: GeneratedEntry[] = [];
  const entry = (e: Omit<GeneratedEntry, "allDay" | "auto">) => entries.push({ ...e, allDay: true, auto: true });

  const [members, rentConfig, rotations, logs, trips, travels, chores] = await Promise.all([
    prisma.apartmentMember.findMany({ where: { apartmentId }, select: { status: true, moveInDate: true, user: { select: { id: true, name: true } } } }),
    prisma.rentConfig.findUnique({ where: { apartmentId } }),
    prisma.cleaningRotation.findMany({ where: { apartmentId, isActive: true } }),
    prisma.cleaningLog.findMany({ where: { apartmentId, cleanedAt: { gte: from, lte: to } }, include: { cleanedBy: { select: { name: true } } } }),
    prisma.shoppingTrip.findMany({ where: { apartmentId, status: "COMPLETED", endedAt: { gte: from, lte: to } }, include: { shopper: { select: { name: true } } } }),
    prisma.travelPeriod.findMany({ where: { apartmentId, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] }, include: { user: { select: { name: true } } } }),
    prisma.chore.findMany({ where: { apartmentId, status: "PENDING", dueDate: { gte: from, lte: to } }, include: { assignedTo: { select: { name: true } } } }),
  ]);
  const name = (id: string) => members.find(m => m.user.id === id)?.user.name ?? "Someone";

  // Rent: every recorded month, and the coming months the setup will start.
  if (rentConfig) {
    const recorded = await rentMonths(apartmentId, rentConfig.dueDay, now);
    const seen = new Set<string>();
    for (const m of recorded) {
      const due = rentDueDate(m.month, rentConfig.dueDay);
      seen.add(m.month);
      if (!inRange(due)) continue;
      const state = [m.landlordPaidAt ? "Landlord paid" : "Landlord not paid yet", m.stillToCollect > 0 ? `${usd(m.stillToCollect)} still to collect` : m.expected > 0 ? "everyone paid back" : null].filter(Boolean).join(" · ");
      entry({ id: `auto:rent:${m.month}`, type: "RENT", title: `Rent due · ${usd(m.totalAmount)}`, startDate: noon(due), endDate: null, notes: state, href: `${base}/rent` });
    }
    for (let k = 0; k <= 3; k++) {
      const month = shiftMonth(currentMonth(now), k);
      const due = rentDueDate(month, rentConfig.dueDay);
      if (seen.has(month) || !inRange(due) || due < now) continue;
      entry({ id: `auto:rent:${month}`, type: "RENT", title: `Rent due · ${usd(rentConfig.totalAmount)}`, startDate: noon(due), endDate: null, notes: `${monthLabel(month)} · starts by itself 3 days before`, href: `${base}/rent` });
    }
  }

  // Cleaning: the next turns of each rotation (people away or not moved in yet are skipped, as on the Schedule), and recent cleanings.
  const arriving = members.filter(m => m.status !== "MOVED_OUT" && m.moveInDate && m.moveInDate > now);
  const spans: TravelSpan[] = [
    ...travels.map(t => ({ userId: t.userId, startDate: t.startDate, endDate: t.endDate, returnedAt: t.returnedAt })),
    ...arriving.map(m => notMovedInSpan(m.user.id, m.moveInDate!)),
  ];
  for (const r of rotations) {
    const order: string[] = JSON.parse(r.memberOrder);
    if (!r.nextDue || order.length === 0) continue;
    upcomingTurns({ memberOrder: order, currentIndex: r.currentIndex, nextDue: r.nextDue, frequency: r.frequency }, spans, 6).forEach((t, i) => {
      if (!t.due || !inRange(t.due)) return;
      entry({ id: `auto:cleaning:${r.id}:${i}`, type: "CLEANING", title: `Cleaning: ${name(t.userId)}`, startDate: noon(t.due), endDate: null, notes: i === 0 ? "Current turn" : null, href: `${base}/cleaning` });
    });
  }
  for (const l of logs) {
    entry({ id: `auto:cleaned:${l.id}`, type: "CLEANING", title: `Cleaned by ${l.cleanedBy.name}`, startDate: noon(l.cleanedAt), endDate: null, notes: l.notes, href: `${base}/cleaning` });
  }

  // Shopping: trips done, and whose turn it is today.
  for (const t of trips) {
    entry({
      id: `auto:trip:${t.id}`, type: "SHOPPING", title: `Shopping: ${t.shopper.name}${t.totalAmount != null ? ` · ${usd(t.totalAmount)}` : ""}`,
      startDate: noon(t.endedAt ?? t.startedAt), endDate: null, notes: null, href: `${base}/shopping`,
    });
  }
  const turn = await shoppingTurn(apartmentId, { now });
  if (turn.shopperId) {
    entry({
      id: "auto:shopping-turn", type: "SHOPPING", title: turn.trip ? `${name(turn.shopperId)} is shopping` : `${name(turn.shopperId)}'s turn to shop`,
      startDate: noon(now), endDate: null, notes: null, href: `${base}/shopping`,
    });
  }

  // Who's away: until they're back (or until further notice).
  for (const t of travels) {
    const end = t.returnedAt ?? t.endDate;
    if (t.returnedAt && t.returnedAt < from) continue;
    entry({
      id: `auto:away:${t.id}`, type: "TRAVEL", title: `${t.user.name} away`, startDate: noon(t.startDate), endDate: end ? noon(end) : null,
      notes: end ? null : "Until further notice", href: `${base}/members`,
    });
  }

  // Moving in (Home Setup, Sprint 11b): the day a new member arrives.
  for (const m of members) {
    if (!m.moveInDate || m.status === "MOVED_OUT" || !inRange(m.moveInDate)) continue;
    entry({ id: `auto:move-in:${m.user.id}`, type: "EVENT", title: `${m.user.name} moves in`, startDate: noon(m.moveInDate), endDate: null, notes: null, href: `${base}/members` });
  }

  // Chores with a due date.
  for (const c of chores) {
    entry({
      id: `auto:chore:${c.id}`, type: "CHORE", title: `Chore: ${c.title}${c.assignedTo ? ` (${c.assignedTo.name})` : ""}`,
      startDate: noon(c.dueDate!), endDate: null, notes: null, href: `${base}/chores`,
    });
  }

  return entries.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
