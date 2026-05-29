import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notify } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: apartmentId, userId: otherUserId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.directMessage.findMany({
    where: {
      apartmentId,
      OR: [
        { senderId: payload.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: payload.userId },
      ],
    },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Mark received messages as read
  await prisma.directMessage.updateMany({
    where: { apartmentId, senderId: otherUserId, receiverId: payload.userId, read: false },
    data: { read: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: apartmentId, userId: receiverId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!member || member.role === "GUEST") return NextResponse.json({ error: "Guests cannot send messages" }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const message = await prisma.directMessage.create({
    data: { apartmentId, senderId: payload.userId, receiverId, content: content.trim() },
    include: { sender: { select: { id: true, name: true } } },
  });

  const preview = content.trim().length > 80 ? content.trim().slice(0, 80) + "…" : content.trim();
  await notify({
    apartmentId,
    userIds: [receiverId],
    type: "DIRECT_MESSAGE",
    title: message.sender.name,
    body: preview,
    link: `/apartment/${apartmentId}/chat/dm/${payload.userId}`,
  });

  return NextResponse.json(message, { status: 201 });
}
