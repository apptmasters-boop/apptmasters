import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }); // YYYY-MM

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const cycles = await prisma.rentCycle.findMany({
    where: { apartmentId },
    include: {
      rentPayer: { select: { id: true, name: true } },
      payments: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { month: "desc" },
  });

  return NextResponse.json(cycles);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  if (!config) return NextResponse.json({ error: "Rent not configured yet" }, { status: 400 });

  const shares: Record<string, number> = JSON.parse(config.shares);
  const activeMembers = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    select: { userId: true },
  });
  const memberIds = activeMembers.map(m => m.userId).filter(id => id !== config.rentPayerId);
  const equalShare = parseFloat((config.totalAmount / (memberIds.length + 1)).toFixed(2));

  const cycle = await prisma.rentCycle.create({
    data: {
      month: parsed.data.month,
      apartmentId,
      rentPayerId: config.rentPayerId!,
      totalAmount: config.totalAmount,
      markedPaidAt: new Date(),
      payments: {
        create: memberIds.map(userId => ({
          userId,
          amount: shares[userId] ?? equalShare,
        })),
      },
    },
    include: {
      rentPayer: { select: { id: true, name: true } },
      payments: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(cycle, { status: 201 });
}
