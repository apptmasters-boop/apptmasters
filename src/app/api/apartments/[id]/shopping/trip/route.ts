import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notify } from "@/lib/notify";
import { shoppingTurn, TRIP_STEPS, type TripStep } from "@/lib/shopping";
import { isAwayOn, nextMemberIndex } from "@/lib/rotation";

/**
 * Moves the shopping trip on (PRODUCT_LOGIC §10.5). Body: { action }.
 * "start" is for the person whose turn it is; every other step is for the
 * shopper of the trip under way, and only goes forward.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;
  if (access.membership.role === "GUEST") return NextResponse.json({ error: "Guests don't take part in shopping" }, { status: 403 });

  const { action } = await req.json().catch(() => ({}));
  const turn = await shoppingTurn(apartmentId, { save: true });

  if (action === "start") {
    if (turn.trip) return NextResponse.json({ error: "A shopping trip is already under way" }, { status: 409 });
    if (turn.shopperId !== userId) return NextResponse.json({ error: "It's not your turn to shop" }, { status: 403 });
    const trip = await prisma.shoppingTrip.create({ data: { apartmentId, shopperId: userId } });
    return NextResponse.json(trip, { status: 201 });
  }

  const step = TRIP_STEPS[action as TripStep];
  if (!step) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const trip = turn.trip;
  if (!trip) return NextResponse.json({ error: "No shopping trip is under way" }, { status: 409 });
  if (trip.shopperId !== userId) return NextResponse.json({ error: "Only the shopper can do this" }, { status: 403 });
  if (!step.from.includes(trip.status)) return NextResponse.json({ error: "That step isn't available right now" }, { status: 409 });

  const now = new Date();
  const stamp = action === "at_store" ? { atStoreAt: now }
    : action === "left_store" ? { leftStoreAt: now }
    : action === "finish" ? { endedAt: now, leftStoreAt: trip.leftStoreAt ?? now }
    : { endedAt: now };

  let nextShopperId: string | null = null;
  const moved = await prisma.$transaction(async tx => {
    // Only moves on if nobody changed the trip in the meantime (two taps, two devices).
    const { count } = await tx.shoppingTrip.updateMany({ where: { id: trip.id, status: trip.status }, data: { status: step.to, ...stamp } });
    if (count === 0 || action !== "finish") return count > 0;

    // Ticked items were bought on this trip and leave the list; the rest wait for next time.
    await tx.groceryItem.updateMany({ where: { apartmentId, tripId: null, purchased: true }, data: { tripId: trip.id } });

    const travels = await tx.travelPeriod.findMany({
      where: { apartmentId, returnedAt: null, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      select: { userId: true, startDate: true, endDate: true, returnedAt: true },
    });
    if (turn.order.length > 0) {
      const from = turn.order.indexOf(trip.shopperId);
      const nextIndex = nextMemberIndex(turn.order, from >= 0 ? from : turn.currentIndex, uid => isAwayOn(travels, uid, now));
      nextShopperId = turn.order[nextIndex];
      await tx.shoppingRotation.update({ where: { apartmentId }, data: { currentIndex: nextIndex } });
    }
    return true;
  });
  if (!moved) return NextResponse.json({ error: "The trip has already moved on" }, { status: 409 });

  if (nextShopperId && nextShopperId !== userId) {
    await notify({
      apartmentId, userIds: [nextShopperId], type: "SHOPPING_TURN",
      title: "Your turn to do the shopping",
      body: `${turn.names[userId] ?? "Someone"} finished the last trip. The shared list is ready for you.`,
      link: `/apartment/${apartmentId}/shopping`,
    });
  }
  return NextResponse.json({ ok: true, status: step.to });
}
