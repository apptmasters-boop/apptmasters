import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const borrow = await prisma.borrowRequest.findFirst({
    where: { inventoryItemId: itemId, borrowerId: userId, status: "ACTIVE", inventoryItem: { apartmentId } },
  });
  if (!borrow) return NextResponse.json({ error: "No active borrow found" }, { status: 404 });

  const updated = await prisma.borrowRequest.update({
    where: { id: borrow.id },
    data: { status: "RETURNED", returnedAt: new Date() },
  });

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  await notifyApartment(
    apartmentId, userId, "ITEM_RETURNED",
    "Item returned",
    `${user?.name} returned "${item?.name}"`,
    `/apartment/${apartmentId}/inventory`,
  );

  return NextResponse.json(updated);
}
