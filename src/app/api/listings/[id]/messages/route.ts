import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

async function resolveOtherUserId(
  req: NextRequest,
  listingId: string,
  currentUserId: string
): Promise<{ otherUserId: string; listingTitle: string; senderIsOwner: boolean } | { error: string; status: number }> {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, title: true } });
  if (!listing) return { error: "Not found", status: 404 };

  if (listing.ownerId === currentUserId) {
    const withUserId = req.nextUrl.searchParams.get("with");
    if (!withUserId) return { error: "Missing 'with' user", status: 400 };
    return { otherUserId: withUserId, listingTitle: listing.title, senderIsOwner: true };
  }

  return { otherUserId: listing.ownerId, listingTitle: listing.title, senderIsOwner: false };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: listingId } = await params;

  const resolved = await resolveOtherUserId(req, listingId, payload.userId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { otherUserId } = resolved;

  const messages = await prisma.listingMessage.findMany({
    where: {
      listingId,
      OR: [
        { senderId: payload.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: payload.userId },
      ],
    },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  await prisma.listingMessage.updateMany({
    where: { listingId, senderId: otherUserId, receiverId: payload.userId, read: false },
    data: { read: true },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: listingId } = await params;

  const resolved = await resolveOtherUserId(req, listingId, payload.userId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { otherUserId, listingTitle, senderIsOwner } = resolved;

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const message = await prisma.listingMessage.create({
    data: { listingId, senderId: payload.userId, receiverId: otherUserId, content: content.trim() },
    include: { sender: { select: { id: true, name: true } } },
  });

  const receiver = await prisma.user.findUnique({ where: { id: otherUserId }, select: { email: true, name: true } });
  if (receiver?.email) {
    const preview = content.trim().length > 80 ? content.trim().slice(0, 80) + "…" : content.trim();
    const replyLink = senderIsOwner
      ? `${appUrl}/listings/${listingId}/messages`
      : `${appUrl}/listings/${listingId}/messages?with=${payload.userId}`;
    sendEmail(
      receiver.email,
      `New message about "${listingTitle}" — ${message.sender.name}`,
      notificationEmail(
        `${message.sender.name} sent you a message`,
        preview,
        replyLink,
        "Reply"
      )
    ).catch(() => {});
  }

  return NextResponse.json(message, { status: 201 });
}
