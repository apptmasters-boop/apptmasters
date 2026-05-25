import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rotationId: string }> }) {
  const { id: apartmentId, rotationId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rotation = await prisma.purchaseRotation.findFirst({ where: { id: rotationId, apartmentId } });
  if (!rotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order: string[] = JSON.parse(rotation.memberOrder);
  const nextIndex = (rotation.currentIndex + 1) % order.length;
  const nextUserId = order[nextIndex];

  const updated = await prisma.purchaseRotation.update({
    where: { id: rotationId },
    data: { currentIndex: nextIndex, lastBought: new Date() },
  });

  const buyer = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const next = await prisma.user.findUnique({ where: { id: nextUserId }, select: { name: true } });

  await notifyApartment(
    apartmentId, null, "EXPENSE_ADDED",
    `${rotation.itemName} purchased`,
    `${buyer?.name} bought ${rotation.itemName}. Next up: ${next?.name}`,
  );

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; rotationId: string }> }) {
  const { id: apartmentId, rotationId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (member?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  await prisma.purchaseRotation.deleteMany({ where: { id: rotationId, apartmentId } });
  return NextResponse.json({ ok: true });
}
