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

  const items = await prisma.groceryItem.findMany({
    where: { apartmentId },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: [{ purchased: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, quantity } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  const item = await prisma.groceryItem.create({
    data: { apartmentId, addedById: payload.userId, name, quantity: quantity ?? "1" },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  await notifyApartment(
    apartmentId,
    payload.userId,
    "GROCERY_ADDED",
    "Grocery list updated",
    `${user?.name} added "${name}" to the grocery list`,
    `/apartment/${apartmentId}/grocery`,
  );

  return NextResponse.json(item, { status: 201 });
}
