import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

// PATCH = mark as returned (or extend end date)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; travelId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: apartmentId, travelId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await prisma.travelPeriod.findUnique({ where: { id: travelId } });
  if (!period || period.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only self or admin can update
  if (period.userId !== payload.userId && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.returned) data.returnedAt = new Date();
  if (body.endDate) data.endDate = new Date(body.endDate);

  const updated = await prisma.travelPeriod.update({
    where: { id: travelId },
    data,
    include: { user: { select: { id: true, name: true } } },
  });

  if (body.returned) {
    // Notify other members
    const others = await prisma.apartmentMember.findMany({
      where: { apartmentId, status: "ACTIVE", userId: { not: period.userId } },
      select: { userId: true },
    });
    if (others.length > 0) {
      await prisma.notification.createMany({
        data: others.map(m => ({
          userId: m.userId,
          apartmentId,
          type: "MEMBER_RETURNED",
          title: `${updated.user.name} is back`,
          body: "They've returned from travel — cleaning and expenses are back to normal.",
          link: `/apartment/${apartmentId}`,
        })),
      });
    }
  }

  return NextResponse.json(updated);
}
