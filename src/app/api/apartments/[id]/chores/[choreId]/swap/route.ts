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
    const swap = await prisma.choreSwapRequest.findUnique({ where: { id: respond.data.swapId } });
    if (!swap || swap.toUserId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (respond.data.accept) {
      await prisma.chore.update({ where: { id: choreId }, data: { assignedUserId: swap.fromUserId } });
      await prisma.choreSwapRequest.update({ where: { id: swap.id }, data: { status: "ACCEPTED" } });
      return NextResponse.json({ accepted: true });
    } else {
      await prisma.choreSwapRequest.update({ where: { id: swap.id }, data: { status: "REJECTED" } });
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

  const swapRequest = await prisma.choreSwapRequest.create({
    data: { choreId, fromUserId: payload.userId, toUserId: request.data.toUserId },
    include: { toUser: { select: { id: true, name: true } } },
  });

  return NextResponse.json(swapRequest, { status: 201 });
}
