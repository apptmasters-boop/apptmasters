import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notify } from "@/lib/notify";
import { isAwayOn, nextMemberIndex } from "@/lib/rotation";

// "Can't clean this week?" (PRODUCT_LOGIC §8.2): the person whose turn it is
// asks the next person to swap. Nothing changes until that person accepts
// (POST /api/apartments/[id]/cleaning/swaps/[swapId]).
const schema = z.object({ reason: z.string().trim().max(300).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rotationId: string }> }) {
  const { id: apartmentId, rotationId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Reason is too long" }, { status: 400 });

  const rotation = await prisma.cleaningRotation.findFirst({ where: { id: rotationId, apartmentId } });
  if (!rotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order: string[] = JSON.parse(rotation.memberOrder);
  if (order[rotation.currentIndex % order.length] !== access.userId) {
    return NextResponse.json({ error: "You can only ask to swap during your own turn" }, { status: 403 });
  }
  const pending = await prisma.cleaningSwapRequest.findFirst({ where: { rotationId, status: "PENDING" } });
  if (pending) return NextResponse.json({ error: "A swap is already waiting for an answer" }, { status: 409 });

  // The person who would clean next (skipping anyone away today)
  const now = new Date();
  const travels = await prisma.travelPeriod.findMany({
    where: { apartmentId, returnedAt: null, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
    select: { userId: true, startDate: true, endDate: true, returnedAt: true },
  });
  const targetId = order[nextMemberIndex(order, rotation.currentIndex, uid => isAwayOn(travels, uid, now))];
  if (!targetId || targetId === access.userId) {
    return NextResponse.json({ error: "There's nobody available to swap with right now" }, { status: 409 });
  }

  const swap = await prisma.cleaningSwapRequest.create({
    data: { apartmentId, rotationId, requesterId: access.userId, targetId, reason: parsed.data.reason || null },
  });
  const requester = await prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } });
  await notify({
    apartmentId, userIds: [targetId], type: "CLEANING_SWAP_REQUEST", sendEmailTo: [targetId],
    title: `${requester?.name ?? "A roommate"} asked you to swap cleaning turns`,
    body: parsed.data.reason ? `Reason: ${parsed.data.reason}` : "They can't clean this week. Accept to clean now and give them your next turn.",
    link: `/apartment/${apartmentId}/cleaning`,
  }).catch(() => {});

  return NextResponse.json(swap, { status: 201 });
}
