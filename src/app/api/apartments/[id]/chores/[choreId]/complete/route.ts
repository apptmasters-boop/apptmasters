import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adjustScore } from "@/lib/score";

const schema = z.object({ photoUrl: z.string().optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; choreId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, choreId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const chore = await prisma.chore.update({
    where: { id: choreId },
    data: { status: "DONE", completedAt: new Date(), completedById: payload.userId },
  });

  if (parsed.success && parsed.data.photoUrl) {
    await prisma.chorePhoto.create({
      data: { url: parsed.data.photoUrl, choreId, takenById: payload.userId },
    });
  }

  // Schedule next occurrence for recurring chores
  const freqDays: Record<string, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };
  const days = freqDays[chore.frequency];
  if (days && chore.assignmentType !== "VOLUNTARY") {
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + days);

    // Rotate assignee if ROTATING
    let nextAssignee = chore.assignedUserId;
    if (chore.assignmentType === "ROTATING" && chore.assignedUserId) {
      const members = await prisma.apartmentMember.findMany({
        where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      });
      const ids = members.map(m => m.userId);
      const currentIdx = ids.indexOf(chore.assignedUserId);
      nextAssignee = ids[(currentIdx + 1) % ids.length];
    }

    await prisma.chore.create({
      data: {
        title: chore.title,
        assignmentType: chore.assignmentType,
        frequency: chore.frequency,
        dueDate: nextDue,
        roomId: chore.roomId,
        apartmentId,
        assignedUserId: nextAssignee,
        points: chore.points,
      },
    });
  }

  // Award score points for completing a chore
  await adjustScore(payload.userId, apartmentId, chore.points, `Completed chore: ${chore.title}`).catch(() => {});

  return NextResponse.json(chore);
}
