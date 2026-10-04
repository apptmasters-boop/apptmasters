import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { createFeedItem } from "@/lib/feed";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const items = await prisma.feedItem.findMany({
    where: { apartmentId },
    include: {
      user: { select: { id: true, name: true } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const { title, body } = await req.json();
  if (!title || !body) return NextResponse.json({ error: "title and body required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const item = await prisma.feedItem.create({
    data: { apartmentId, userId, type: "ANNOUNCEMENT", title, body, isAnnouncement: true },
    include: {
      user: { select: { id: true, name: true } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  await notifyApartment(
    apartmentId,
    userId,
    "ANNOUNCEMENT",
    `Announcement from ${user?.name}`,
    title,
    `/apartment/${apartmentId}/feed`,
  );

  return NextResponse.json(item, { status: 201 });
}
