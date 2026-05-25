import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const limit = 50;

  const messages = await prisma.chatMessage.findMany({
    where: {
      apartmentId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      sender: { select: { id: true, name: true } },
      replyTo: { include: { sender: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Mark as read
  await Promise.all(
    messages
      .filter(m => {
        const readBy: string[] = JSON.parse(m.readBy || "[]");
        return !readBy.includes(payload.userId);
      })
      .map(m => {
        const readBy: string[] = JSON.parse(m.readBy || "[]");
        return prisma.chatMessage.update({
          where: { id: m.id },
          data: { readBy: JSON.stringify([...readBy, payload.userId]) },
        });
      }),
  );

  return NextResponse.json(messages.reverse());
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!member || member.role === "GUEST") return NextResponse.json({ error: "Guests cannot send messages" }, { status: 403 });

  const { content, type, replyToId } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const isEmergency = type === "EMERGENCY";

  const message = await prisma.chatMessage.create({
    data: {
      apartmentId,
      senderId: payload.userId,
      content: content.trim(),
      type: isEmergency ? "EMERGENCY" : "TEXT",
      replyToId: replyToId ?? null,
      readBy: JSON.stringify([payload.userId]),
    },
    include: {
      sender: { select: { id: true, name: true } },
      replyTo: { include: { sender: { select: { id: true, name: true } } } },
    },
  });

  if (isEmergency) {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
    await notifyApartment(
      apartmentId, payload.userId, "NUDGE",
      `🚨 Emergency from ${user?.name}`,
      content.trim(),
      `/apartment/${apartmentId}/chat`,
    );
  }

  return NextResponse.json(message, { status: 201 });
}
