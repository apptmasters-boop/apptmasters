import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.reorderThreshold !== undefined ? { reorderThreshold: body.reorderThreshold } : {}),
      ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } : {}),
      ...(body.condition !== undefined ? { condition: body.condition } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  // Alert if dropped to or below threshold
  if (body.quantity !== undefined && updated.quantity <= updated.reorderThreshold) {
    await notifyApartment(
      apartmentId,
      null,
      "FUND_LOW",
      "Low inventory alert",
      `"${updated.name}" is running low (${updated.quantity} ${updated.unit} remaining)`,
      `/apartment/${apartmentId}/inventory`,
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inventoryItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
