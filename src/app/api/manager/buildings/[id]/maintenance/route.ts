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
    select: { id: true, number: true, apartmentId: true },
  });

  const apartmentIds = units.map(u => u.apartmentId).filter(Boolean) as string[];
  if (apartmentIds.length === 0) return NextResponse.json([]);

  const requests = await prisma.maintenanceRequest.findMany({
    where: { apartmentId: { in: apartmentIds } },
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  const unitByApartment = Object.fromEntries(
    units.filter(u => u.apartmentId).map(u => [u.apartmentId!, u.number])
  );

  const result = requests.map(r => ({
    ...r,
    unitNumber: unitByApartment[r.apartmentId] ?? null,
  }));

  return NextResponse.json(result);
}
