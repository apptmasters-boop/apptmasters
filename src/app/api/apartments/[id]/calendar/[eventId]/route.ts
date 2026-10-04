import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

// Only the event's creator or an apartment admin may change or delete it.
const canModify = (eventUserId: string, userId: string, role: string) => eventUserId === userId || role === "ADMIN";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id: apartmentId, eventId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, apartmentId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canModify(event.userId, access.userId, access.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.calendarEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id: apartmentId, eventId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, apartmentId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canModify(event.userId, access.userId, access.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.startDate !== undefined ? { startDate: new Date(body.startDate) } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}
