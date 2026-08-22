import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adjustScore } from "@/lib/score";
import { notify } from "@/lib/notify";

// 2-day grace period after the due date before a missed turn costs points
const GRACE_PERIOD_MS = 2 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - GRACE_PERIOD_MS);

  const rotations = await prisma.cleaningRotation.findMany({
    where: { isActive: true, nextDue: { lte: cutoff } },
    include: { apartment: { select: { name: true } } },
  });

  let penalized = 0;

  for (const rotation of rotations) {
    if (!rotation.nextDue) continue;
    // Already docked for this exact missed period
    if (rotation.lastPenaltyDueDate?.getTime() === rotation.nextDue.getTime()) continue;

    const order: string[] = JSON.parse(rotation.memberOrder);
    const currentTurnUserId = order[rotation.currentIndex % order.length];

    const traveling = await prisma.travelPeriod.findFirst({
      where: {
        apartmentId: rotation.apartmentId,
        userId: currentTurnUserId,
        startDate: { lte: now },
        returnedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
    if (traveling) continue;

    await adjustScore(
      currentTurnUserId,
      rotation.apartmentId,
      -5,
      `Missed cleaning turn for ${rotation.apartment.name} (due ${rotation.nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
    );

    await prisma.cleaningRotation.update({
      where: { id: rotation.id },
      data: { lastPenaltyDueDate: rotation.nextDue },
    });

    await notify({
      apartmentId: rotation.apartmentId,
      userIds: [currentTurnUserId],
      type: "CLEANING_PENALTY",
      title: "Cleaning turn missed",
      body: "You missed your cleaning turn and lost 5 rating points. Mark it done as soon as you can.",
      link: `/apartment/${rotation.apartmentId}/cleaning`,
      sendEmailTo: [currentTurnUserId],
    });

    penalized++;
  }

  return NextResponse.json({ penalized });
}
