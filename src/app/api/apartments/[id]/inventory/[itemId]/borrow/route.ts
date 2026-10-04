import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, apartmentId, isShared: true } });
  if (!item) return NextResponse.json({ error: "Item not found or not shared" }, { status: 404 });

  const existing = await prisma.borrowRequest.findFirst({
    where: { inventoryItemId: itemId, borrowerId: userId, status: "ACTIVE" },
  });
  if (existing) return NextResponse.json({ error: "You already have this item borrowed" }, { status: 400 });

  const { notes } = await req.json().catch(() => ({ notes: null }));

  const borrow = await prisma.borrowRequest.create({
    data: { inventoryItemId: itemId, borrowerId: userId, apartmentId, notes: notes ?? null },
    include: { borrower: { select: { id: true, name: true } } },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await notifyApartment(
    apartmentId, userId, "ITEM_BORROWED",
    "Item borrowed",
    `${user?.name} borrowed "${item.name}"`,
    `/apartment/${apartmentId}/inventory`,
  );

  return NextResponse.json(borrow, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const borrows = await prisma.borrowRequest.findMany({
    where: { inventoryItemId: itemId, apartmentId },
    include: { borrower: { select: { id: true, name: true } } },
    orderBy: { borrowedAt: "desc" },
  });

  return NextResponse.json(borrows);
}
