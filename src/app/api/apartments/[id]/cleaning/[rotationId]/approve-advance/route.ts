import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { notify } from "@/lib/notify";
import { nextDueDate, nextMemberIndex } from "@/lib/rotation";

// POST = admin approves a pending out-of-turn advance request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const { id: apartmentId, rotationId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const caller = access.membership;
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
  const nextIndex = nextMemberIndex(order, rotation.currentIndex, uid => travelingIds.has(uid));

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
      nextDue: nextDueDate(rotation.frequency, rotation.nextDue ?? now),
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
