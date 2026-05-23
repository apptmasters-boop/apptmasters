import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { createFeedItem } from "@/lib/feed";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.calendarEvent.findMany({
    where: { apartmentId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.title || !body.startDate) return NextResponse.json({ error: "title and startDate required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  const event = await prisma.calendarEvent.create({
    data: {
      apartmentId,
      userId: payload.userId,
      title: body.title,
      type: body.type ?? "EVENT",
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      allDay: body.allDay ?? true,
      notes: body.notes ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await createFeedItem({
    apartmentId,
    userId: payload.userId,
    type: "ANNOUNCEMENT",
    title: `${user?.name} added an event`,
    body: `${body.title} on ${new Date(body.startDate).toLocaleDateString()}`,
    link: `/apartment/${apartmentId}/calendar`,
  });

  await notifyApartment(
    apartmentId,
    payload.userId,
    "EXPENSE_ADDED",
    "New calendar event",
    `${user?.name} added "${body.title}" on ${new Date(body.startDate).toLocaleDateString()}`,
    `/apartment/${apartmentId}/calendar`,
  );

  return NextResponse.json(event, { status: 201 });
}
