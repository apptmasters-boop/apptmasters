import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { shoppingTurn } from "@/lib/shopping";
import { isAwayOn, nextMemberIndex } from "@/lib/rotation";
import { awaySpans } from "@/lib/away";
import { splitMembers, awayNow } from "@/lib/expenses";

/** Household → Shopping: whose turn it is, who's next, and the trip under way (PRODUCT_LOGIC §10). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const turn = await shoppingTurn(apartmentId, { save: true });
  const now = new Date();
  const travels = await awaySpans(apartmentId, now);
  const away = (uid: string) => isAwayOn(travels, uid, now);
  const person = (id: string | null | undefined) => (id ? { id, name: turn.names[id] ?? "Someone" } : null);

  const shopperIndex = turn.shopperId ? turn.order.indexOf(turn.shopperId) : -1;
  const nextId = turn.order.length > 1 && shopperIndex >= 0 ? turn.order[nextMemberIndex(turn.order, shopperIndex, away)] : null;
  const lastTrip = await prisma.shoppingTrip.findFirst({
    where: { apartmentId, status: "COMPLETED" },
    orderBy: { endedAt: "desc" },
    select: { endedAt: true, totalAmount: true, shopper: { select: { name: true } }, _count: { select: { items: true } }, expense: { select: { splits: { select: { userId: true } } } } },
  });
  // Who the shopper can split the trip with at checkout (Sprint 6); people away start unticked.
  const [sharers, awayForSplit] = turn.shopperId ? await Promise.all([splitMembers(apartmentId), awayNow(apartmentId, turn.shopperId, now)]) : [[], new Set<string>()];

  return NextResponse.json({
    shopper: person(turn.shopperId),
    next: person(nextId),
    order: turn.order.map(id => ({ id, name: turn.names[id] ?? "Someone", away: away(id) })),
    trip: turn.trip && {
      id: turn.trip.id, status: turn.trip.status, shopperId: turn.trip.shopperId,
      startedAt: turn.trip.startedAt, homeCheck: turn.trip.homeCheck, atStoreAt: turn.trip.atStoreAt,
      totalAmount: turn.trip.totalAmount, receiptUrl: turn.trip.receiptUrl,
      splitWith: turn.trip.splitWith ? JSON.parse(turn.trip.splitWith) as string[] : null,
    },
    splitOptions: sharers.map(p => ({ id: p.id, name: p.name, away: awayForSplit.has(p.id) })),
    lastTrip: lastTrip && {
      endedAt: lastTrip.endedAt, totalAmount: lastTrip.totalAmount, shopperName: lastTrip.shopper.name, itemCount: lastTrip._count.items,
      splitCount: lastTrip.expense?.splits.length ?? null,
    },
  });
}
