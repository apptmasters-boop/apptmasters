import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";

/**
 * POST { paid: boolean }: the landlord payment for one month (PRODUCT_LOGIC §12.1),
 * separate from what roommates owe the rent payer. The month's rent payer (or a
 * household admin, to correct a mistake) marks it, or undoes it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; cycleId: string }> }) {
  const { id: apartmentId, cycleId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const cycle = await prisma.rentCycle.findFirst({ where: { id: cycleId, apartmentId } });
  if (!cycle) return NextResponse.json({ error: "Month not found" }, { status: 404 });
  if (cycle.rentPayerId !== access.userId && access.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the rent payer can mark the landlord paid" }, { status: 403 });
  }

  const { paid } = await req.json().catch(() => ({}));
  if (typeof paid !== "boolean") return NextResponse.json({ error: "Say whether the landlord was paid" }, { status: 400 });

  const updated = await prisma.rentCycle.update({ where: { id: cycle.id }, data: { markedPaidAt: paid ? new Date() : null } });
  return NextResponse.json({ id: updated.id, landlordPaidAt: updated.markedPaidAt });
}
