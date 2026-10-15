/**
 * The Home priority feed (docs/PRODUCT_LOGIC.md §6): "What needs my attention
 * now?" for one member of one household, built from data the app already has.
 *
 *   P1 Critical   urgent repairs that aren't fixed
 *   P2 Money      my rent share due/overdue, what I owe, payments waiting for me to confirm
 *   P3 My turn    my cleaning/shopping turn, my chores due, votes and approvals waiting for me
 *   P4 Coming up  household calendar events in the next 7 days
 *   P5 Recently   the last few household updates
 *
 * Only things that concern the viewer appear (someone else's turn doesn't).
 * Chat messages never appear; they're on the Chat badge (§16).
 */
import { prisma } from "@/lib/db";
import { ledgerEntries, netDebts } from "@/lib/ledger";
import { position, net } from "@/lib/moneySummary";
import { shoppingTurn } from "@/lib/shopping";
import { rentDueDate, monthLabel } from "@/lib/rent";
import { currentStep, canConfirmFix, activeMemberIds } from "@/lib/maintenance";

export type Priority = 1 | 2 | 3 | 4 | 5;

export interface FeedItem {
  /** Stable key, e.g. "maintenance:<id>". */
  id: string;
  priority: Priority;
  title: string;
  detail?: string;
  /** Where the user acts on it (path inside the app). */
  href: string;
  /** ISO date the item is about (due date, event start, …); used for ordering. */
  when?: string;
  /** Past its due date. */
  overdue?: boolean;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Priority first, then the earliest date; undated items last within a priority. */
export function sortFeed(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) =>
    a.priority - b.priority ||
    (a.when ? Date.parse(a.when) : Infinity) - (b.when ? Date.parse(b.when) : Infinity));
}

// Rent due dates live with the other rent rules (src/lib/rent.ts); re-exported for existing callers.
export { rentDueDate };

const currentOf = (memberOrder: string, currentIndex: number): string | undefined => {
  try {
    const order = JSON.parse(memberOrder) as string[];
    return order.length ? order[currentIndex % order.length] : undefined;
  } catch {
    return undefined;
  }
};

export async function buildHomeFeed(apartmentId: string, userId: string, role: string, now = new Date()): Promise<FeedItem[]> {
  const base = `/apartment/${apartmentId}`;
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const isAdmin = role === "ADMIN";

  const [urgentRepairs, rentConfig, myRentPayments, toConfirmRent, ledger, cashToConfirm, cleaning, purchases,
    myChores, editRequests, joinRequests, events, recent] = await Promise.all([
    // Urgent repairs stay at the top until the landlord side has completed them (Sprint 8).
    prisma.maintenanceRequest.findMany({ where: { apartmentId, priority: "URGENT", status: { notIn: ["COMPLETED", "RESOLVED"] } }, orderBy: { createdAt: "asc" } }),
    prisma.rentConfig.findUnique({ where: { apartmentId }, select: { dueDay: true } }),
    prisma.rentPayment.findMany({ where: { userId, status: "PENDING", rentCycle: { apartmentId } }, include: { rentCycle: { select: { month: true } } } }),
    prisma.rentPayment.count({ where: { status: "PAID", paymentId: null, userId: { not: userId }, rentCycle: { apartmentId, rentPayerId: userId } } }),
    ledgerEntries(apartmentId),
    prisma.expenseSplit.findMany({
      where: { status: "PENDING_CASH", paymentId: null, userId: { not: userId }, expense: { apartmentId, paidById: userId } },
      include: { user: { select: { name: true } }, expense: { select: { title: true } } },
    }),
    prisma.cleaningRotation.findMany({ where: { apartmentId } }),
    prisma.purchaseRotation.findMany({ where: { apartmentId } }),
    prisma.chore.findMany({ where: { apartmentId, assignedUserId: userId, status: "PENDING", dueDate: { lte: endOfToday } }, orderBy: { dueDate: "asc" }, take: 5 }),
    prisma.expenseEditRequest.count({
      where: { apartmentId, status: "PENDING", requesterId: { not: userId }, approvals: { none: { approverId: userId } } },
    }),
    isAdmin ? prisma.apartmentMember.count({ where: { apartmentId, status: "PENDING_APPROVAL" } }) : Promise.resolve(0),
    prisma.calendarEvent.findMany({ where: { apartmentId, startDate: { gte: now, lte: in7Days } }, orderBy: { startDate: "asc" }, take: 5 }),
    prisma.feedItem.findMany({ where: { apartmentId }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  const swapsForMe = await prisma.cleaningSwapRequest.findMany({
    where: { apartmentId, targetId: userId, status: "PENDING" },
    include: { requester: { select: { name: true } } },
  });
  const shopping = await shoppingTurn(apartmentId);
  const shoppingListSize = shopping.shopperId === userId ? await prisma.groceryItem.count({ where: { apartmentId, tripId: null, purchased: false } }) : 0;

  const items: FeedItem[] = [];

  // P1 — critical
  for (const r of urgentRepairs) {
    const step = currentStep(r.status);
    const detail = step === "SCHEDULED" ? "Repair visit scheduled" : step === "IN_PROGRESS" ? "Being worked on" : step === "ACKNOWLEDGED" ? "The landlord knows" : "Not fixed yet";
    items.push({ id: `maintenance:${r.id}`, priority: 1, title: `Urgent repair: ${r.title}`, detail, href: `${base}/maintenance`, when: r.createdAt.toISOString() });
  }

  // P2 — money
  if (myRentPayments.length > 0) {
    const dueDay = rentConfig?.dueDay ?? 1;
    const total = myRentPayments.reduce((s, p) => s + p.amount, 0);
    const earliest = myRentPayments.map(p => rentDueDate(p.rentCycle.month, dueDay)).sort((a, b) => a.getTime() - b.getTime())[0];
    const overdue = now.getTime() >= earliest.getTime() + 86_400_000; // late once the due day is over, as on the Rent page
    items.push({
      id: "rent:mine", priority: 2, overdue, href: `${base}/rent`, when: earliest.toISOString(),
      title: overdue ? `Your rent share is overdue: ${money(total)}` : `Your rent share is due ${shortDate(earliest)}: ${money(total)}`,
      detail: myRentPayments.length > 1 ? `${myRentPayments.length} months not paid yet` : "Mark it paid once you've paid the rent payer",
    });
  }
  // The rent payer: pay the landlord (§12.1), from when the month starts until it's marked paid.
  const landlordToPay = await prisma.rentCycle.findMany({ where: { apartmentId, rentPayerId: userId, markedPaidAt: null }, orderBy: { month: "asc" } });
  for (const c of landlordToPay) {
    const due = rentDueDate(c.month, rentConfig?.dueDay ?? 1);
    const late = now.getTime() >= due.getTime() + 86_400_000;
    items.push({
      id: `rent:landlord:${c.id}`, priority: 2, overdue: late, href: `${base}/rent`, when: due.toISOString(),
      title: `Pay the landlord: ${monthLabel(c.month).split(" ")[0]} rent`,
      detail: `${money(c.totalAmount)} · ${late ? "was due" : "due"} ${shortDate(due)} · tap "I paid the landlord" once you have`,
    });
  }
  if (toConfirmRent > 0) {
    items.push({ id: "rent:confirm", priority: 2, href: `${base}/rent`, title: `Confirm ${toConfirmRent} rent ${toConfirmRent === 1 ? "payment" : "payments"}`, detail: "Roommates marked their share as paid to you" });
  }
  // What I owe from the Money ledger, rent included (§11.2). When it's only rent,
  // the rent item above already says so with its due date.
  const owe = position(netDebts(ledger), userId).owe;
  const expensePart = net(netDebts(ledger.filter(e => e.source === "expense")), userId);
  const rentPart = net(netDebts(ledger.filter(e => e.source === "rent")), userId);
  if (owe > 0 && expensePart > 0) {
    items.push({
      id: "money:owed", priority: 2, href: `${base}/money`, title: `You owe ${money(owe)}`,
      detail: rentPart > 0 ? `${money(rentPart)} rent · ${money(expensePart)} shared expenses` : "Shared expenses · see Money",
    });
  }
  // Recorded payments (Sprint 5c) are confirmed as a whole, in Money.
  const paymentsToConfirm = await prisma.payment.findMany({
    where: { apartmentId, toUserId: userId, status: "PENDING" },
    include: { fromUser: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const p of paymentsToConfirm) {
    items.push({ id: `payment:${p.id}`, priority: 2, href: `${base}/money`, title: `${p.fromUser.name} says they paid you ${money(p.amount)}`, detail: "Confirm once you've received it" });
  }
  for (const c of cashToConfirm) {
    items.push({ id: `cash:${c.id}`, priority: 2, href: `${base}/finance`, title: `${c.user.name} says they paid you ${money(c.amount)} in cash`, detail: `For "${c.expense.title}" · confirm or deny` });
  }

  // P3 — my turn
  for (const r of cleaning) {
    if (currentOf(r.memberOrder, r.currentIndex) !== userId) continue;
    const overdue = !!r.nextDue && r.nextDue < now;
    items.push({
      id: `cleaning:${r.id}`, priority: 3, overdue, href: `${base}/cleaning`, when: r.nextDue?.toISOString(),
      title: overdue ? "Your cleaning turn is late" : "It's your turn to clean",
      detail: r.nextDue ? `Due ${shortDate(r.nextDue)}` : undefined,
    });
  }
  if (isAdmin) {
    for (const r of cleaning) {
      if (r.pendingAdvanceById && r.pendingAdvanceById !== userId) {
        items.push({ id: `cleaning-approve:${r.id}`, priority: 3, href: `${base}/cleaning`, title: "A cleaning turn needs your approval", detail: "Someone asked to pass the rotation on" });
      }
    }
  }
  for (const s of swapsForMe) {
    items.push({ id: `cleaning-swap:${s.id}`, priority: 3, href: `${base}/cleaning`, title: `${s.requester.name} asked you to swap cleaning turns`, detail: s.reason ?? "Accept or decline" });
  }
  // Shopping turn: only once there's something to buy, so an empty list isn't a to-do.
  if (shopping.shopperId === userId && shopping.trip) {
    items.push({ id: "shopping-trip", priority: 3, href: `${base}/shopping`, title: "Your shopping trip is under way", detail: "Pick up where you left off" });
  } else if (shopping.shopperId === userId && shoppingListSize > 0) {
    items.push({ id: "shopping-turn", priority: 3, href: `${base}/shopping`, title: "Your turn to do the shopping",
      detail: `${shoppingListSize} ${shoppingListSize === 1 ? "item" : "items"} on the list` });
  }
  for (const r of purchases) {
    if (currentOf(r.memberOrder, r.currentIndex) !== userId) continue;
    items.push({ id: `purchase:${r.id}`, priority: 3, href: `${base}/rotation`, title: `Your turn to buy ${r.itemName}` });
  }
  for (const c of myChores) {
    const overdue = !!c.dueDate && c.dueDate < now;
    items.push({ id: `chore:${c.id}`, priority: 3, overdue, href: `${base}/chores`, when: c.dueDate?.toISOString(), title: c.title, detail: overdue ? "Chore · late" : "Chore · due today" });
  }
  if (editRequests > 0) {
    items.push({ id: "expense-edits", priority: 3, href: `${base}/finance`, title: `${editRequests} expense ${editRequests === 1 ? "change" : "changes"} waiting for your vote` });
  }
  // No landlord on Apartment Masters: household admins pass new repair requests on (Sprint 8, owner's decision).
  if (isAdmin) {
    const home = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
    if (!home?.managerId) {
      const reported = await prisma.maintenanceRequest.findMany({
        where: { apartmentId, status: { in: ["REPORTED", "OPEN"] } },
        include: { submittedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      for (const r of reported) {
        items.push({
          id: `maintenance-tell:${r.id}`, priority: 3, href: `${base}/maintenance`, when: r.createdAt.toISOString(),
          title: `Tell the landlord: ${r.title}`, detail: `Reported by ${r.submittedBy.name} · then record their answer in Maintenance`,
        });
      }
    }
  }
  // "Is it fixed?" (Sprint 8b): for the person who reported it, or an admin once they've moved out.
  const completedRepairs = await prisma.maintenanceRequest.findMany({ where: { apartmentId, status: "COMPLETED" }, select: { id: true, title: true, status: true, submittedById: true, completedAt: true } });
  if (completedRepairs.length > 0) {
    const here = await activeMemberIds(apartmentId);
    for (const r of completedRepairs) {
      if (!canConfirmFix(r, userId, role, here)) continue;
      items.push({
        id: `maintenance-fixed:${r.id}`, priority: 3, href: `${base}/maintenance`, when: r.completedAt?.toISOString(),
        title: `Is it fixed? ${r.title}`, detail: "The repair is marked done. Say if it isn't.",
      });
    }
  }
  if (joinRequests > 0) {
    items.push({ id: "join-requests", priority: 3, href: `${base}/settings`, title: `${joinRequests} ${joinRequests === 1 ? "person wants" : "people want"} to join`, detail: "Approve or decline" });
  }

  // P4 — coming up
  for (const e of events) {
    items.push({ id: `event:${e.id}`, priority: 4, href: `${base}/calendar`, when: e.startDate.toISOString(), title: e.title, detail: shortDate(e.startDate) });
  }

  // P5 — recently
  for (const f of recent) {
    items.push({ id: `feed:${f.id}`, priority: 5, href: `${base}/feed`, title: f.title, when: undefined });
  }

  return sortFeed(items);
}
