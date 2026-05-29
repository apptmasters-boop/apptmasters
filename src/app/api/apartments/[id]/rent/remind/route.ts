import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

const schema = z.object({ cycleId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cycle = await prisma.rentCycle.findUnique({
    where: { id: parsed.data.cycleId },
    include: {
      payments: {
        where: { confirmedAt: null },
        include: { user: { select: { id: true, name: true } } },
      },
      rentPayer: { select: { name: true } },
    },
  });

  if (!cycle || cycle.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const unpaidUserIds = cycle.payments.map(p => p.userId);
  if (unpaidUserIds.length === 0) {
    return NextResponse.json({ message: "Everyone has already paid." });
  }

  await notify({
    apartmentId,
    userIds: unpaidUserIds,
    type: "RENT_REMINDER",
    title: "Rent reminder",
    body: `Your rent payment for ${cycle.month} is still outstanding. Please pay ${cycle.rentPayer.name} as soon as possible.`,
    link: `/apartment/${apartmentId}/rent`,
    sendEmailTo: unpaidUserIds,
  });

  return NextResponse.json({ reminded: unpaidUserIds.length });
}
