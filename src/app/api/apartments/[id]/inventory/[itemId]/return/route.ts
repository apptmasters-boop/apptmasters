import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const borrow = await prisma.borrowRequest.findFirst({
    where: { inventoryItemId: itemId, borrowerId: payload.userId, status: "ACTIVE" },
  });
  if (!borrow) return NextResponse.json({ error: "No active borrow found" }, { status: 404 });

  const updated = await prisma.borrowRequest.update({
    where: { id: borrow.id },
    data: { status: "RETURNED", returnedAt: new Date() },
  });

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true } });
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  await notifyApartment(
    apartmentId, payload.userId, "EXPENSE_ADDED",
    "Item returned",
    `${user?.name} returned "${item?.name}"`,
    `/apartment/${apartmentId}/inventory`,
  );

  return NextResponse.json(updated);
}
