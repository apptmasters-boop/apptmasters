import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { notify } from "@/lib/notify";
import { nextDueDate, nextWeekdayDate } from "@/lib/rotation";

// POST = mark done & advance to next person
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId, rotationId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rotation = await prisma.cleaningRotation.findUnique({ where: { id: rotationId } });
  if (!rotation || rotation.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  if (rotation.nextDue && now < rotation.nextDue) {
    return NextResponse.json({
      error: `The rotation already advanced for this period. Next turn opens ${rotation.nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
    }, { status: 400 });
  }

  // Parse optional photo/notes from body
  let photoUrl: string | undefined;
  let notes: string | undefined;
  try {
    const body = await req.json();
    photoUrl = body.photoUrl || undefined;
    notes = body.notes || undefined;
  } catch { /* body is optional */ }

  const order: string[] = JSON.parse(rotation.memberOrder);
  const currentTurnUserId = order[rotation.currentIndex % order.length];

  // Out-of-turn advance: queue for admin approval instead of applying immediately
  if (payload.userId !== currentTurnUserId) {
    if (rotation.pendingAdvanceById) {
      return NextResponse.json(
        { error: "A request to advance this rotation is already pending admin approval." },
        { status: 409 }
      );
    }

    await prisma.cleaningRotation.update({
      where: { id: rotationId },
      data: {
        pendingAdvanceById: payload.userId,
        pendingAdvancePhotoUrl: photoUrl ?? null,
        pendingAdvanceNotes: notes ?? null,
        pendingAdvanceAt: now,
      },
    });

    const [admins, requester] = await Promise.all([
      prisma.apartmentMember.findMany({
        where: { apartmentId, role: "ADMIN", status: "ACTIVE" },
        select: { userId: true },
      }),
      prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } }),
    ]);

    if (admins.length > 0) {
      await notify({
        apartmentId,
        userIds: admins.map(a => a.userId),
        type: "ROTATION_ADVANCE_REQUEST",
        title: "Rotation advance needs approval",
        body: `${requester?.name ?? "A member"} wants to advance the cleaning rotation out of turn. Review and approve or reject.`,
        link: `/apartment/${apartmentId}/cleaning`,
        sendEmailTo: admins.map(a => a.userId),
      });
    }

    return NextResponse.json(
      { pending: true, message: "Request sent to the apartment admin for approval." },
      { status: 202 }
    );
  }

  const travelers = await prisma.travelPeriod.findMany({
    where: {
      apartmentId,
      startDate: { lte: now },
      returnedAt: null,
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { userId: true },
  });
  const travelingIds = new Set(travelers.map(t => t.userId));

  // Find next non-traveling member
  let nextIndex = rotation.currentIndex;
  for (let i = 1; i <= order.length; i++) {
    const candidate = (rotation.currentIndex + i) % order.length;
    if (!travelingIds.has(order[candidate])) { nextIndex = candidate; break; }
  }

  // Create cleaning log for the person who just cleaned
  await prisma.cleaningLog.create({
    data: {
      rotationId,
      cleanedById: payload.userId,
      apartmentId,
      photoUrl: photoUrl ?? null,
      notes: notes ?? null,
    },
  });

  // Anchor the next due date to the *previous* due date (not to whenever this
  // was actually clicked) so an early or late completion never shifts the
  // fixed schedule the admin set.
  const updated = await prisma.cleaningRotation.update({
    where: { id: rotationId },
    data: { currentIndex: nextIndex, nextDue: nextDueDate(rotation.frequency, rotation.nextDue ?? now) },
  });

  // Email the next cleaner
  const nextUserId = order[nextIndex];
  const nextUser = await prisma.user.findUnique({
    where: { id: nextUserId },
    select: { name: true, email: true },
  });

  if (nextUser?.email) {
    const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { name: true } });
    const freqLabel = rotation.frequency === "DAILY" ? "daily" : rotation.frequency === "WEEKLY" ? "this week" : "this month";
    sendEmail(
      nextUser.email,
      `It's your turn to clean — ${apt?.name ?? "your apartment"}`,
      notificationEmail(
        "Cleaning rotation",
        `Hi ${nextUser.name}, it's your turn to clean the apartment ${freqLabel}!`,
        `${appUrl}/apartment/${apartmentId}/cleaning`,
        "View schedule",
      )
    ).catch(() => {});
  }

  return NextResponse.json(updated);
}

// DELETE = remove rotation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId, rotationId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rotation = await prisma.cleaningRotation.findUnique({ where: { id: rotationId } });
  if (!rotation || rotation.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cleaningRotation.delete({ where: { id: rotationId } });
  return NextResponse.json({ success: true });
}

// PATCH = update frequency or member order
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId, rotationId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { frequency, memberIds, dueWeekday } = await req.json();
  const data: Record<string, unknown> = {};
  if (frequency) data.frequency = frequency;
  if (memberIds?.length >= 2) {
    data.memberOrder = JSON.stringify(memberIds);
    data.currentIndex = 0;
  }
  if (frequency) {
    const hasWeekday = frequency === "WEEKLY" && Number.isInteger(dueWeekday) && dueWeekday >= 0 && dueWeekday <= 6;
    data.dueWeekday = hasWeekday ? dueWeekday : null;
    data.nextDue = hasWeekday ? nextWeekdayDate(dueWeekday) : nextDueDate(frequency);
  }

  const updated = await prisma.cleaningRotation.update({ where: { id: rotationId }, data });
  return NextResponse.json(updated);
}
