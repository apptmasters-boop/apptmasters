import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: apartmentId, itemId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groceryItem = await prisma.groceryItem.findFirst({ where: { id: itemId, apartmentId } });
  if (!groceryItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Mark grocery item purchased
  await prisma.groceryItem.update({
    where: { id: itemId },
    data: { purchased: true, purchasedAt: new Date() },
  });

  // Create inventory item from it
  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      apartmentId,
      name: groceryItem.name,
      category: body.category ?? "SUPPLIES",
      quantity: parseFloat(groceryItem.quantity) || 1,
      unit: body.unit ?? "units",
      reorderThreshold: body.reorderThreshold ?? 1,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      isShared: body.isShared ?? true,
      condition: "GOOD",
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(inventoryItem, { status: 201 });
}
