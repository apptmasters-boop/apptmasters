import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.listingMessage.findMany({
    where: { OR: [{ senderId: payload.userId }, { receiverId: payload.userId }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      listing: { select: { id: true, title: true, photos: { orderBy: { position: "asc" }, take: 1 } } },
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });

  const seen = new Set<string>();
  const conversations = [];
  for (const m of messages) {
    const other = m.senderId === payload.userId ? m.receiver : m.sender;
    const key = `${m.listingId}:${other.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    conversations.push({
      listingId: m.listingId,
      listingTitle: m.listing.title,
      listingPhoto: m.listing.photos[0]?.url ?? null,
      otherUserId: other.id,
      otherUserName: other.name,
      lastMessage: m.content,
      lastMessageAt: m.createdAt,
      unread: m.receiverId === payload.userId && !m.read,
    });
  }

  return NextResponse.json(conversations);
}
