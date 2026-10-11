/**
 * Shopping turn and trip rules (docs/PRODUCT_LOGIC.md §10.1–10.7).
 *
 * One household shopping turn: everyone living here except guests, in the
 * order they joined unless an admin changed it. A trip is one card per step
 * (owner's flow, 2026-10-09), and only the shopper moves it on:
 *
 *   PREPARING    do the inventory, or skip it         → READY
 *   READY        "I'm at the store"                   → SHOPPING
 *   SHOPPING     tick items into the cart, then enter
 *                the total and the receipt, validate  → CHECKED_OUT
 *   CHECKED_OUT  "I've left the store"                → COMPLETED (turn passes on)
 *
 * The total and receipt are saved on the trip; turning them into the grocery
 * expense and balances is Sprint 6, on the new Money ledger.
 */
import { prisma } from "@/lib/db";
import { syncOrder } from "@/lib/rotation";
import { notify, pushIfEnabled } from "@/lib/notify";

/** A trip in one of these states is under way; there is at most one per home. */
export const ACTIVE_TRIP = ["PREPARING", "READY", "SHOPPING", "CHECKED_OUT"];

export type TripStep = "inventory_done" | "skip_inventory" | "at_store" | "checkout" | "left_store" | "cancel";

/** Which states each step can be taken from, and where it leads. */
export const TRIP_STEPS: Record<TripStep, { from: string[]; to: string }> = {
  inventory_done: { from: ["PREPARING"], to: "READY" },
  skip_inventory: { from: ["PREPARING"], to: "READY" }, // the inventory never blocks shopping (§10.2)
  at_store: { from: ["READY"], to: "SHOPPING" },
  // Validating again from CHECKED_OUT corrects a mistyped total before leaving.
  checkout: { from: ["SHOPPING", "CHECKED_OUT"], to: "CHECKED_OUT" },
  left_store: { from: ["CHECKED_OUT"], to: "COMPLETED" },
  cancel: { from: ACTIVE_TRIP, to: "CANCELLED" },
};

/** Largest total a shopper can type, as a guard against extra zeros. */
export const MAX_TRIP_TOTAL = 10_000;

/** Receipts are uploaded through /api/upload/receipt; anything else is refused. */
export const isReceiptUrl = (url: unknown): url is string =>
  typeof url === "string" && /^\/uploads\/receipts\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(url);

/** Who takes part in the shopping turn, in the order they joined. */
export async function shoppers(apartmentId: string) {
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, name: true } } },
  });
  return members.map(m => m.user);
}

/**
 * The current shopping turn: the order (kept in step with who lives here), the
 * shopper, and the trip under way if there is one. During a trip the shopper is
 * whoever started it. `save` stores the order when it changed (or the first time).
 */
export async function shoppingTurn(apartmentId: string, { save = false } = {}) {
  const [people, saved, trip] = await Promise.all([
    shoppers(apartmentId),
    prisma.shoppingRotation.findUnique({ where: { apartmentId } }),
    prisma.shoppingTrip.findFirst({ where: { apartmentId, status: { in: ACTIVE_TRIP } }, orderBy: { startedAt: "desc" } }),
  ]);
  const synced = syncOrder(saved ? JSON.parse(saved.memberOrder) : [], saved?.currentIndex ?? 0, people.map(p => p.id));
  const memberOrder = JSON.stringify(synced.order);
  if (save && synced.order.length > 0 && (!saved || saved.memberOrder !== memberOrder || saved.currentIndex !== synced.currentIndex)) {
    await prisma.shoppingRotation.upsert({
      where: { apartmentId },
      create: { apartmentId, memberOrder, currentIndex: synced.currentIndex },
      update: { memberOrder, currentIndex: synced.currentIndex },
    });
  }
  return {
    order: synced.order,
    currentIndex: synced.currentIndex,
    shopperId: trip?.shopperId ?? synced.order[synced.currentIndex] ?? null,
    trip,
    names: Object.fromEntries(people.map(p => [p.id, p.name])) as Record<string, string>,
  };
}

/** While items keep coming in, the shopper's phone buzzes at most this often; the notification always shows the full list. */
export const ALERT_EVERY_MS = 2 * 60_000;

/**
 * Tells the shopper at the store that someone added to the list (§10.4).
 * Quick additions are grouped into the shopper's unread notification for this
 * trip ("3 new items on your list: Tomatoes, Milk, Rice") instead of one each.
 */
export async function alertShopper(trip: { apartmentId: string; shopperId: string; atStoreAt: Date | null }, itemName: string, addedByName: string, now = new Date()) {
  const link = `/apartment/${trip.apartmentId}/shopping`;
  const open = await prisma.notification.findFirst({
    where: { userId: trip.shopperId, apartmentId: trip.apartmentId, type: "SHOPPING_ITEMS", read: false, createdAt: { gte: trip.atStoreAt ?? now } },
    orderBy: { createdAt: "desc" },
  });
  if (!open) {
    await notify({ apartmentId: trip.apartmentId, userIds: [trip.shopperId], type: "SHOPPING_ITEMS", title: `${addedByName} added to your list`, body: itemName, link });
    return;
  }
  const names = [...open.body.split(", "), itemName];
  const title = `${names.length} new items on your list`;
  const body = names.join(", ");
  const buzz = now.getTime() - open.createdAt.getTime() >= ALERT_EVERY_MS;
  // createdAt doubles as "last buzzed", so the next buzz waits another ALERT_EVERY_MS.
  await prisma.notification.update({ where: { id: open.id }, data: { title, body, ...(buzz ? { createdAt: now } : {}) } });
  if (buzz) await pushIfEnabled(trip.shopperId, title, body, link);
}
