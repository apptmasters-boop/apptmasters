import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { createFeedItem } from "@/lib/feed";
import { notifyApartment } from "@/lib/notify";
import { generatedEntries } from "@/lib/calendarFeed";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const [events, generated] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { apartmentId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    }),
    // Dates other modules already know (PRODUCT_LOGIC §15): read-only, `auto: true`, with a link to where they're handled.
    generatedEntries(apartmentId),
  ]);

  const all = [
    ...events.map(e => ({ ...e, startDate: e.startDate.toISOString(), endDate: e.endDate?.toISOString() ?? null, auto: false })),
    ...generated.map(g => ({ ...g, user: { id: "", name: "" } })),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return NextResponse.json(all);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const body = await req.json();
  if (!body.title || !body.startDate) return NextResponse.json({ error: "title and startDate required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const event = await prisma.calendarEvent.create({
    data: {
      apartmentId,
      userId,
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
    userId,
    type: "ANNOUNCEMENT",
    title: `${user?.name} added an event`,
    body: `${body.title} on ${new Date(body.startDate).toLocaleDateString()}`,
    link: `/apartment/${apartmentId}/calendar`,
  });

  await notifyApartment(
    apartmentId,
    userId,
    "CALENDAR_EVENT",
    "New calendar event",
    `${user?.name} added "${body.title}" on ${new Date(body.startDate).toLocaleDateString()}`,
    `/apartment/${apartmentId}/calendar`,
  );

  return NextResponse.json(event, { status: 201 });
}
