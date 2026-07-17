import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: buildingId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const building = await prisma.building.findFirst({
    where: { id: buildingId, managerId: payload.userId },
  });
  if (!building) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: {
      apartment: {
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          rentConfig: true,
          rentCycles: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { payments: true },
          },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const result = units.map(unit => {
    if (!unit.apartment) {
      return {
        unitId: unit.id,
        unitNumber: unit.number,
        rentAmount: unit.rentAmount,
        status: "vacant" as const,
        tenants: [],
        currentCycle: null,
      };
    }

    const tenants = unit.apartment.members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    }));

    const latestCycle = unit.apartment.rentCycles[0] ?? null;
    const isCurrentMonth = latestCycle?.month === currentMonth;
    const allPaid = latestCycle?.payments.every(p => p.status === "PAID" || p.status === "CONFIRMED") ?? false;
    const anyPaid = latestCycle?.payments.some(p => p.status === "PAID" || p.status === "CONFIRMED") ?? false;

    let status: "vacant" | "paid" | "partial" | "pending" | "no_cycle";
    if (!latestCycle || !isCurrentMonth) status = "no_cycle";
    else if (allPaid) status = "paid";
    else if (anyPaid) status = "partial";
    else status = "pending";

    return {
      unitId: unit.id,
      unitNumber: unit.number,
      rentAmount: unit.rentAmount ?? unit.apartment.rentConfig?.totalAmount ?? null,
      status,
      tenants,
      currentCycle: latestCycle ? {
        month: latestCycle.month,
        total: latestCycle.totalAmount,
        payments: latestCycle.payments.map(p => ({
          userId: p.userId,
          amount: p.amount,
          status: p.status,
          method: p.method,
          paidAt: p.paidAt,
        })),
      } : null,
    };
  });

  return NextResponse.json(result);
}
