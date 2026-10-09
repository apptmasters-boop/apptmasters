import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notify } from "@/lib/notify";
import { swapPositions } from "@/lib/rotation";

// Answer a cleaning swap request: the person asked accepts or declines; the
// person who asked can cancel. On accept they trade places in the rotation
// order, so the one asked cleans now and the requester takes their next turn.
const schema = z.object({ action: z.enum(["accept", "decline", "cancel"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; swapId: string }> }) {
  const { id: apartmentId, swapId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { action } = parsed.data;

  const swap = await prisma.cleaningSwapRequest.findFirst({
    where: { id: swapId, apartmentId },
    include: { requester: { select: { name: true } }, target: { select: { name: true } } },
  });
  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (swap.status !== "PENDING") return NextResponse.json({ error: "This request was already answered" }, { status: 409 });

  const allowed = action === "cancel" ? swap.requesterId === access.userId : swap.targetId === access.userId;
  if (!allowed) {
    return NextResponse.json({ error: action === "cancel" ? "Only the person who asked can cancel" : "Only the person asked can answer" }, { status: 403 });
  }

  if (action === "accept") {
    const result = await prisma.$transaction(async tx => {
      const rotation = await tx.cleaningRotation.findUnique({ where: { id: swap.rotationId } });
      const order: string[] = rotation ? JSON.parse(rotation.memberOrder) : [];
      // The turn may have moved on since the request was sent
      if (!rotation || order[rotation.currentIndex % order.length] !== swap.requesterId) {
        await tx.cleaningSwapRequest.update({ where: { id: swapId }, data: { status: "CANCELLED", respondedAt: new Date() } });
        return "stale" as const;
      }
      await tx.cleaningRotation.update({
        where: { id: rotation.id },
        data: { memberOrder: JSON.stringify(swapPositions(order, swap.requesterId, swap.targetId)) },
      });
      await tx.cleaningSwapRequest.update({ where: { id: swapId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      return "ok" as const;
    });
    if (result === "stale") return NextResponse.json({ error: "The turn has already moved on, so this swap no longer applies" }, { status: 409 });
  } else {
    await prisma.cleaningSwapRequest.update({
      where: { id: swapId },
      data: { status: action === "decline" ? "DECLINED" : "CANCELLED", respondedAt: new Date() },
    });
  }

  if (action !== "cancel") {
    const accepted = action === "accept";
    await notify({
      apartmentId, userIds: [swap.requesterId], type: accepted ? "CLEANING_SWAP_ACCEPTED" : "CLEANING_SWAP_DECLINED",
      title: accepted ? `${swap.target.name} will clean this week` : `${swap.target.name} can't swap this time`,
      body: accepted ? "You'll take their next turn instead." : "The cleaning turn stays with you.",
      link: `/apartment/${apartmentId}/cleaning`,
    }).catch(() => {});
  }

  return NextResponse.json({ status: action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED" });
}
