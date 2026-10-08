import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

// Unread counts for the Chat badge in the bottom navigation (PRODUCT_LOGIC §5, §16).
// Group messages count as read once the member has opened the chat (readBy);
// direct messages have their own read flag.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const [group, direct] = await Promise.all([
    prisma.chatMessage.count({
      where: { apartmentId, senderId: { not: userId }, NOT: { readBy: { contains: `"${userId}"` } } },
    }),
    prisma.directMessage.count({ where: { apartmentId, receiverId: userId, read: false } }),
  ]);

  return NextResponse.json({ group, direct, total: group + direct });
}
