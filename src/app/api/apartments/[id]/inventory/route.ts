import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    where: { apartmentId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const item = await prisma.inventoryItem.create({
    data: {
      apartmentId,
      name: body.name,
      category: body.category ?? "SUPPLIES",
      quantity: body.quantity ?? 1,
      unit: body.unit ?? "units",
      reorderThreshold: body.reorderThreshold ?? 1,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      isShared: body.isShared ?? true,
      condition: body.condition ?? "GOOD",
      notes: body.notes ?? null,
    },
  });

  // Notify if starting low
  if (item.quantity <= item.reorderThreshold) {
    await notifyApartment(
      apartmentId,
      null,
      "FUND_LOW",
      "Low inventory alert",
      `"${item.name}" is running low (${item.quantity} ${item.unit} remaining)`,
      `/apartment/${apartmentId}/inventory`,
    );
  }

  return NextResponse.json(item, { status: 201 });
}
