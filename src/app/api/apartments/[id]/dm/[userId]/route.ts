import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: apartmentId, userId: otherUserId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
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
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!member || member.role === "GUEST") return NextResponse.json({ error: "Guests cannot send messages" }, { status: 403 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const message = await prisma.directMessage.create({
    data: { apartmentId, senderId: payload.userId, receiverId, content: content.trim() },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json(message, { status: 201 });
}
