import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.groceryItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.groceryItem.update({
    where: { id: itemId },
    data: {
      ...(body.purchased !== undefined ? { purchased: body.purchased, purchasedAt: body.purchased ? new Date() : null } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
    },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.groceryItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.groceryItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
