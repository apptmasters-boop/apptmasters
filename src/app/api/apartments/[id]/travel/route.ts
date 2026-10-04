import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const periods = await prisma.travelPeriod.findMany({
    where: {
      apartmentId,
      returnedAt: null,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(periods);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, startDate, endDate, notes } = await req.json();

  // Only self or admin can mark as traveling
  if (userId !== payload.userId && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the target is a member
  const targetMembership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId, apartmentId } },
  });
  if (!targetMembership) return NextResponse.json({ error: "User is not a member" }, { status: 404 });

  const period = await prisma.travelPeriod.create({
    data: {
      userId,
      apartmentId,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  // Notify other members
  const others = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", userId: { not: userId } },
    select: { userId: true },
  });
  if (others.length > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const until = endDate ? ` until ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
    await prisma.notification.createMany({
      data: others.map(m => ({
        userId: m.userId,
        apartmentId,
        type: "MEMBER_TRAVELING",
        title: `${user?.name ?? "Someone"} is traveling`,
        body: `They'll be away${until}. Cleaning and expenses will adjust.`,
        link: `/apartment/${apartmentId}`,
      })),
    });
  }

  return NextResponse.json(period, { status: 201 });
}
