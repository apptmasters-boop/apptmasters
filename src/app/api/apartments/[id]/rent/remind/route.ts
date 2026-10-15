import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { monthLabel } from "@/lib/rent";

const schema = z.object({ cycleId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const cycle = await prisma.rentCycle.findUnique({
    where: { id: parsed.data.cycleId },
    include: {
      payments: {
        // Only people who haven't paid: those waiting for confirmation already did (§12.2).
        where: { status: "PENDING" },
        include: { user: { select: { id: true, name: true } } },
      },
      rentPayer: { select: { name: true } },
    },
  });

  if (!cycle || cycle.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }
  // The rent payer collects the money, so they can remind too, not only admins.
  if (cycle.rentPayerId !== access.userId && access.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the rent payer or a household admin can send reminders" }, { status: 403 });
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
    body: `Your rent share for ${monthLabel(cycle.month)} is still unpaid. Please pay ${cycle.rentPayer.name} and mark it paid in Money → Rent.`,
    link: `/apartment/${apartmentId}/rent`,
    sendEmailTo: unpaidUserIds,
  });

  return NextResponse.json({ reminded: unpaidUserIds.length });
}
