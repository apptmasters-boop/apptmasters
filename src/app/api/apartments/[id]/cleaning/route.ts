import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { nextDueDate, nextWeekdayDate } from "@/lib/rotation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rotations = await prisma.cleaningRotation.findMany({
    where: { apartmentId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      logs: {
        orderBy: { cleanedAt: "desc" },
        take: 3,
        include: { cleanedBy: { select: { id: true, name: true } } },
      },
    },
  });

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

  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
  });
  const memberMap = Object.fromEntries(members.map(m => [m.user.id, m.user]));

  const enriched = rotations.map(r => {
    const order: string[] = JSON.parse(r.memberOrder);
    const current = order[r.currentIndex % order.length];
    const nextIndex = (() => {
      for (let i = 1; i <= order.length; i++) {
        const idx = (r.currentIndex + i) % order.length;
        if (!travelingIds.has(order[idx])) return idx;
      }
      return (r.currentIndex + 1) % order.length;
    })();
    return {
      ...r,
      currentUserId: current,
      currentUserName: memberMap[current]?.name ?? "Unknown",
      nextUserId: order[nextIndex],
      nextUserName: memberMap[order[nextIndex]]?.name ?? "Unknown",
      memberOrder: order.map(id => ({ id, name: memberMap[id]?.name ?? "Unknown", traveling: travelingIds.has(id) })),
      pendingAdvanceByName: r.pendingAdvanceById ? (memberMap[r.pendingAdvanceById]?.name ?? "Unknown") : null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { frequency, memberIds, dueWeekday } = await req.json();
  if (!memberIds?.length || memberIds.length < 2) {
    return NextResponse.json({ error: "At least 2 members required" }, { status: 400 });
  }

  const freq = frequency ?? "WEEKLY";
  const hasWeekday = freq === "WEEKLY" && Number.isInteger(dueWeekday) && dueWeekday >= 0 && dueWeekday <= 6;

  const rotation = await prisma.cleaningRotation.create({
    data: {
      apartmentId,
      name: "Apartment Cleaning",
      frequency: freq,
      memberOrder: JSON.stringify(memberIds),
      currentIndex: 0,
      dueWeekday: hasWeekday ? dueWeekday : null,
      nextDue: hasWeekday ? nextWeekdayDate(dueWeekday) : nextDueDate(freq),
    },
  });

  return NextResponse.json(rotation, { status: 201 });
}
