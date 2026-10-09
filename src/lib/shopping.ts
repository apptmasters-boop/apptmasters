/**
 * Shopping turn and trip rules (docs/PRODUCT_LOGIC.md §10.1, §10.5).
 *
 * One household shopping turn: everyone living here except guests, in the
 * order they joined unless an admin changed it. A trip goes
 * PREPARING → SHOPPING ("I'm at the store") → LEFT_STORE → COMPLETED, and only
 * the shopper moves it on. Finishing passes the turn to the next person who
 * isn't away. Sprint 6 adds the total, receipt and expense to "finish".
 */
import { prisma } from "@/lib/db";
import { syncOrder } from "@/lib/rotation";

/** A trip in one of these states is under way; there is at most one per home. */
export const ACTIVE_TRIP = ["PREPARING", "SHOPPING", "LEFT_STORE"];

export type TripStep = "at_store" | "left_store" | "finish" | "cancel";

/** Which states each step can be taken from, and where it leads. Steps only go forward. */
export const TRIP_STEPS: Record<TripStep, { from: string[]; to: string }> = {
  at_store: { from: ["PREPARING"], to: "SHOPPING" },
  left_store: { from: ["SHOPPING"], to: "LEFT_STORE" },
  // Forgetting to tap "I've left the store" shouldn't block finishing.
  finish: { from: ["SHOPPING", "LEFT_STORE"], to: "COMPLETED" },
  cancel: { from: ACTIVE_TRIP, to: "CANCELLED" },
};

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
