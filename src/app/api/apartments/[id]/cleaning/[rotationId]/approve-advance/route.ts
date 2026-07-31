import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { notify } from "@/lib/notify";

function nextDueDate(frequency: string, from: Date = new Date()): Date {
  const d = new Date(from);
  if (frequency === "DAILY") d.setDate(d.getDate() + 1);
  else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// POST = admin approves a pending out-of-turn advance request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId, rotationId } = await params;

  const caller = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!caller || caller.status !== "ACTIVE" || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rotation = await prisma.cleaningRotation.findUnique({ where: { id: rotationId } });
  if (!rotation || rotation.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!rotation.pendingAdvanceById) {
    return NextResponse.json({ error: "No pending request for this rotation." }, { status: 404 });
  }

  const now = new Date();
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

  const order: string[] = JSON.parse(rotation.memberOrder);
  let nextIndex = rotation.currentIndex;
  for (let i = 1; i <= order.length; i++) {
    const candidate = (rotation.currentIndex + i) % order.length;
    if (!travelingIds.has(order[candidate])) { nextIndex = candidate; break; }
  }

  await prisma.cleaningLog.create({
    data: {
      rotationId,
      cleanedById: rotation.pendingAdvanceById,
      apartmentId,
      photoUrl: rotation.pendingAdvancePhotoUrl,
      notes: rotation.pendingAdvanceNotes,
    },
  });

  const updated = await prisma.cleaningRotation.update({
    where: { id: rotationId },
    data: {
      currentIndex: nextIndex,
      nextDue: nextDueDate(rotation.frequency),
      pendingAdvanceById: null,
      pendingAdvancePhotoUrl: null,
      pendingAdvanceNotes: null,
      pendingAdvanceAt: null,
    },
  });

  await notify({
    apartmentId,
    userIds: [rotation.pendingAdvanceById],
    type: "ROTATION_ADVANCE_REQUEST",
    title: "Rotation advance approved",
    body: "Your request to advance the cleaning rotation was approved.",
    link: `/apartment/${apartmentId}/cleaning`,
    sendEmailTo: [rotation.pendingAdvanceById],
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
