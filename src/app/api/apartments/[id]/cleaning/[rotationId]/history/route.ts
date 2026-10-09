import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

// Cleaning history for one rotation, newest first (the History tab, PRODUCT_LOGIC §8.2).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; rotationId: string }> }) {
  const { id: apartmentId, rotationId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const rotation = await prisma.cleaningRotation.findFirst({ where: { id: rotationId, apartmentId }, select: { id: true } });
  if (!rotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.cleaningLog.findMany({
    where: { rotationId },
    orderBy: { cleanedAt: "desc" },
    take: 100,
    include: { cleanedBy: { select: { id: true, name: true } } },
  });
  // Accepted swaps appear in History alongside cleanings ("Sam cleaned for Alex")
  const swaps = await prisma.cleaningSwapRequest.findMany({
    where: { rotationId, status: "ACCEPTED" },
    orderBy: { respondedAt: "desc" },
    take: 50,
    include: { requester: { select: { id: true, name: true } }, target: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ logs, swaps });
}
