import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notify } from "@/lib/notify";
import { shoppingTurn, TRIP_STEPS, MAX_TRIP_TOTAL, isReceiptUrl, type TripStep } from "@/lib/shopping";
import { isAwayOn, nextMemberIndex } from "@/lib/rotation";

/**
 * Moves the shopping trip on, one card at a time (see src/lib/shopping.ts).
 * Body: { action } and, for "checkout", { total, receiptUrl | noReceipt: true }.
 * "start" is for the person whose turn it is; every other step is for the
 * shopper of the trip under way.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;
  if (access.membership.role === "GUEST") return NextResponse.json({ error: "Guests don't take part in shopping" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
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
  let stamp: Record<string, unknown>;
  switch (action as TripStep) {
    case "inventory_done": stamp = { homeCheck: "DONE" }; break;
    case "skip_inventory": stamp = { homeCheck: "SKIPPED" }; break;
    case "at_store": stamp = { atStoreAt: now }; break;
    case "checkout": {
      const total = Math.round(Number(body.total) * 100) / 100;
      if (!Number.isFinite(total) || total <= 0 || total > MAX_TRIP_TOTAL) {
        return NextResponse.json({ error: `Enter the total you paid (up to ${MAX_TRIP_TOTAL.toLocaleString("en-US")})` }, { status: 400 });
      }
      if (body.noReceipt !== true && !isReceiptUrl(body.receiptUrl)) {
        return NextResponse.json({ error: "Upload a photo of the receipt, or tick \"I don't have the receipt\"" }, { status: 400 });
      }
      stamp = { totalAmount: total, receiptUrl: body.noReceipt === true ? null : body.receiptUrl, checkedOutAt: now };
      break;
    }
    case "left_store": stamp = { leftStoreAt: now, endedAt: now }; break;
    default: stamp = { endedAt: now }; // cancel
  }

  let nextShopperId: string | null = null;
  const moved = await prisma.$transaction(async tx => {
    // Only moves on if nobody changed the trip in the meantime (two taps, two devices).
    const { count } = await tx.shoppingTrip.updateMany({ where: { id: trip.id, status: trip.status }, data: { status: step.to, ...stamp } });
    if (count === 0 || action !== "left_store") return count > 0;

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
