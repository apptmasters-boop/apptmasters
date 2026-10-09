import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const items = await prisma.groceryItem.findMany({
    where: { apartmentId, tripId: null }, // bought on a finished trip = off the list
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: [{ purchased: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const { name, quantity } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const item = await prisma.groceryItem.create({
    data: { apartmentId, addedById: userId, name, quantity: quantity ?? "1" },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  await notifyApartment(
    apartmentId,
    userId,
    "GROCERY_ADDED",
    "Grocery list updated",
    `${user?.name} added "${name}" to the grocery list`,
    `/apartment/${apartmentId}/shopping`,
  );

  return NextResponse.json(item, { status: 201 });
}
