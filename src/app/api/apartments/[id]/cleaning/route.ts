import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember, requireApartmentAdmin } from "@/lib/access";
import { nextDueDate, nextWeekdayDate, nextMemberIndex, upcomingTurns, isAwayOn } from "@/lib/rotation";
import { awaySpans } from "@/lib/away";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
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
  // Current and future trips, and people not moved in yet: away today is skipped now, later in the Schedule
  const travels = await awaySpans(apartmentId, now);
  const travelingIds = new Set(travels.filter(t => isAwayOn([t], t.userId, now)).map(t => t.userId));

  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
  });
  const memberMap = Object.fromEntries(members.map(m => [m.user.id, m.user]));
  const pendingSwaps = await prisma.cleaningSwapRequest.findMany({ where: { apartmentId, status: "PENDING" } });

  const enriched = rotations.map(r => {
    const order: string[] = JSON.parse(r.memberOrder);
    const current = order[r.currentIndex % order.length];
    const nextIndex = nextMemberIndex(order, r.currentIndex, uid => travelingIds.has(uid));
    const schedule = upcomingTurns({ memberOrder: order, currentIndex: r.currentIndex, nextDue: r.nextDue, frequency: r.frequency }, travels, 6)
      .map(t => ({ userId: t.userId, name: memberMap[t.userId]?.name ?? "Unknown", due: t.due }));
    return {
      ...r,
      currentUserId: current,
      currentUserName: memberMap[current]?.name ?? "Unknown",
      nextUserId: order[nextIndex],
      nextUserName: memberMap[order[nextIndex]]?.name ?? "Unknown",
      memberOrder: order.map(id => ({ id, name: memberMap[id]?.name ?? "Unknown", traveling: travelingIds.has(id) })),
      schedule,
      pendingSwap: (() => {
        const p = pendingSwaps.find(s => s.rotationId === r.id);
        return p ? { id: p.id, reason: p.reason, requesterId: p.requesterId, requesterName: memberMap[p.requesterId]?.name ?? "Someone", targetId: p.targetId, targetName: memberMap[p.targetId]?.name ?? "Someone" } : null;
      })(),
      pendingAdvanceByName: r.pendingAdvanceById ? (memberMap[r.pendingAdvanceById]?.name ?? "Unknown") : null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  // Creating, changing or deleting a rotation is for household admins (PRODUCT_LOGIC §8.2).
  const access = await requireApartmentAdmin(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { frequency, memberIds, dueWeekday } = await req.json();
  if (!memberIds?.length || memberIds.length < 2) {
    return NextResponse.json({ error: "At least 2 members required" }, { status: 400 });
  }

  const freq = frequency ?? "WEEKLY";
  const hasWeekday = freq === "WEEKLY" && Number.isInteger(dueWeekday) && dueWeekday >= 0 && dueWeekday <= 6;
  const firstDue = hasWeekday ? nextWeekdayDate(dueWeekday) : nextDueDate(freq);
  // The first turn goes to the first person in the order who isn't away then (travelling or not moved in yet).
  const away = await awaySpans(apartmentId);
  const order: string[] = memberIds;
  const start = nextMemberIndex(order, order.length - 1, uid => isAwayOn(away, uid, firstDue));

  const rotation = await prisma.cleaningRotation.create({
    data: {
      apartmentId,
      name: "Apartment Cleaning",
      frequency: freq,
      memberOrder: JSON.stringify(memberIds),
      currentIndex: start,
      dueWeekday: hasWeekday ? dueWeekday : null,
      nextDue: firstDue,
    },
  });

  return NextResponse.json(rotation, { status: 201 });
}
