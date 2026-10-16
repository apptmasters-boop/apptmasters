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
      listing: { select: { id: true, title: true, city: true, state: true, ownerId: true, price: true, priceMax: true, bedrooms: true, status: true, photos: { orderBy: { position: "asc" }, take: 1 } } },
      // The other person's profile photo and member-since date (Sprint 13g); never their email.
      sender: { select: { id: true, name: true, photo: true, createdAt: true } },
      receiver: { select: { id: true, name: true, photo: true, createdAt: true } },
    },
  });

  // How many messages to me are unread in each conversation (the red count, Sprint 13g).
  const unreadCount = new Map<string, number>();
  for (const m of messages) {
    if (m.receiverId !== payload.userId || m.read) continue;
    const key = `${m.listingId}:${m.senderId}`;
    unreadCount.set(key, (unreadCount.get(key) ?? 0) + 1);
  }

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
      // Home Setup (Sprint 11b) offers the listings you asked about, with their city (never the street address).
      listingCity: [m.listing.city, m.listing.state].filter(Boolean).join(", "),
      myListing: m.listing.ownerId === payload.userId,
      // The listing card in the inbox (Sprint 12 design): price, bedrooms, still available or not.
      listingPrice: m.listing.price,
      listingPriceMax: m.listing.priceMax,
      listingBedrooms: m.listing.bedrooms,
      listingStatus: m.listing.status,
      otherUserId: other.id,
      otherUserName: other.name,
      otherUserPhoto: other.photo,
      otherUserSince: other.createdAt,
      lastMessage: m.content,
      lastMessageAt: m.createdAt,
      unread: m.receiverId === payload.userId && !m.read,
      unreadCount: unreadCount.get(key) ?? 0,
    });
  }

  return NextResponse.json(conversations);
}
