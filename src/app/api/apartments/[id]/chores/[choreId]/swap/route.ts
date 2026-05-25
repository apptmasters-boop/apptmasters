import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const requestSchema = z.object({ toUserId: z.string() });
const respondSchema = z.object({ swapId: z.string(), accept: z.boolean() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; choreId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, choreId } = await params;
  const body = await req.json();

  // Respond to existing swap
  const respond = respondSchema.safeParse(body);
  if (respond.success) {
    const swap = await prisma.choreSwapRequest.findUnique({
      where: { id: respond.data.swapId },
      include: { chore: true, fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } },
    });
    if (!swap || swap.toUserId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (respond.data.accept) {
      await prisma.chore.update({ where: { id: choreId }, data: { assignedUserId: swap.fromUserId } });
      await prisma.choreSwapRequest.update({ where: { id: swap.id }, data: { status: "ACCEPTED" } });
      // Notify the requester their swap was accepted
      await prisma.notification.create({
        data: {
          userId: swap.fromUserId,
          apartmentId,
          type: "NUDGE",
          title: "Swap accepted",
          body: `${swap.toUser.name} accepted your swap request for "${swap.chore.title}"`,
          link: `/apartment/${apartmentId}/rooms`,
        },
      });
      return NextResponse.json({ accepted: true });
    } else {
      await prisma.choreSwapRequest.update({ where: { id: swap.id }, data: { status: "REJECTED" } });
      // Notify the requester their swap was declined
      await prisma.notification.create({
        data: {
          userId: swap.fromUserId,
          apartmentId,
          type: "NUDGE",
          title: "Swap declined",
          body: `${swap.toUser.name} declined your swap request for "${swap.chore.title}"`,
          link: `/apartment/${apartmentId}/rooms`,
        },
      });
      return NextResponse.json({ accepted: false });
    }
  }

  // Create swap request
  const request = requestSchema.safeParse(body);
  if (!request.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  const fromUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  const swapRequest = await prisma.choreSwapRequest.create({
    data: { choreId, fromUserId: payload.userId, toUserId: request.data.toUserId },
    include: { toUser: { select: { id: true, name: true } } },
  });

  // Notify the target member
  if (chore && fromUser) {
    await prisma.notification.create({
      data: {
        userId: request.data.toUserId,
        apartmentId,
        type: "NUDGE",
        title: "Chore swap request",
        body: `${fromUser.name} wants you to take "${chore.title}"`,
        link: `/apartment/${apartmentId}/rooms`,
      },
    });
  }

  return NextResponse.json(swapRequest, { status: 201 });
}
