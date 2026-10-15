import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { startRentMonth, RentError } from "@/lib/rent";

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }); // YYYY-MM

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const cycles = await prisma.rentCycle.findMany({
    where: { apartmentId },
    include: {
      rentPayer: { select: { id: true, name: true } },
      payments: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { month: "desc" },
  });

  return NextResponse.json(cycles);
}

/**
 * POST { month: "YYYY-MM" }: start a month's rent (PRODUCT_LOGIC §12). For the
 * rent payer or a household admin. Starting a month sets every roommate's
 * share; it doesn't mark the landlord paid (that's its own step, §12.1).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { month } = parsed.data;
  // Up to next month: rent isn't recorded for months further ahead.
  const next = new Date(); next.setUTCMonth(next.getUTCMonth() + 1);
  if (month > next.toISOString().slice(0, 7)) return NextResponse.json({ error: "That month is too far ahead" }, { status: 400 });

  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  if (config?.rentPayerId !== access.userId && access.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the rent payer or a household admin can start a month's rent" }, { status: 403 });
  }

  try {
    const { cycle, created } = await startRentMonth(apartmentId, month);
    const full = await prisma.rentCycle.findUniqueOrThrow({
      where: { id: cycle.id },
      include: { rentPayer: { select: { id: true, name: true } }, payments: { include: { user: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json(full, { status: created ? 201 : 200 });
  } catch (e) {
    if (e instanceof RentError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
