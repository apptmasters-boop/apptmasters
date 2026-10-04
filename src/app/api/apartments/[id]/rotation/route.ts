import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const rotations = await prisma.purchaseRotation.findMany({
    where: { apartmentId },
    orderBy: { createdAt: "asc" },
  });

  // Enrich with member names
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: { not: "MOVED_OUT" } },
    include: { user: { select: { id: true, name: true } } },
  });
  const memberMap = Object.fromEntries(members.map(m => [m.user.id, m.user.name]));

  const enriched = rotations.map(r => {
    const order: string[] = JSON.parse(r.memberOrder);
    const current = order[r.currentIndex % order.length];
    return {
      ...r,
      currentUserId: current,
      currentUserName: memberMap[current] ?? "Unknown",
      memberOrder: order.map(id => ({ id, name: memberMap[id] ?? "Unknown" })),
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const member = access.membership;
  if (member?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { itemName, frequency, memberIds } = await req.json();
  if (!itemName || !memberIds?.length) return NextResponse.json({ error: "itemName and memberIds required" }, { status: 400 });

  const rotation = await prisma.purchaseRotation.create({
    data: {
      apartmentId,
      itemName,
      frequency: frequency ?? "MONTHLY",
      memberOrder: JSON.stringify(memberIds),
    },
  });

  const firstBuyer = await prisma.user.findUnique({ where: { id: memberIds[0] }, select: { name: true } });
  await notifyApartment(
    apartmentId,
    payload.userId,
    "ROTATION_CREATED",
    "Rotation added",
    `${firstBuyer?.name ?? "Someone"} is first up to buy ${itemName}.`,
    `/apartment/${apartmentId}/rotation`,
  );

  return NextResponse.json(rotation, { status: 201 });
}
