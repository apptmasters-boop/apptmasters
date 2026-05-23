import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";

const VALID_EMOJIS = ["THUMBS_UP", "NOTED", "QUESTION"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emoji } = await req.json();
  if (!VALID_EMOJIS.includes(emoji)) return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });

  const item = await prisma.feedItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.feedReaction.findUnique({
    where: { feedItemId_userId: { feedItemId: itemId, userId: payload.userId } },
  });

  if (existing) {
    if (existing.emoji === emoji) {
      await prisma.feedReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.feedReaction.update({ where: { id: existing.id }, data: { emoji } });
    }
  } else {
    await prisma.feedReaction.create({ data: { feedItemId: itemId, userId: payload.userId, emoji } });
  }

  const reactions = await prisma.feedReaction.findMany({
    where: { feedItemId: itemId },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(reactions);
}
