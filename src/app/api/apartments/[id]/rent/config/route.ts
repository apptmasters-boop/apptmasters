import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";

const schema = z.object({
  totalAmount: z.number().positive(),
  dueDay: z.number().int().min(1).max(28).default(1),
  landlordName: z.string().optional(),
  rentPayerId: z.string(),
  autoRotate: z.boolean().default(false),
  shares: z.record(z.string(), z.number()).optional(), // { userId: amount }
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  return NextResponse.json(config);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { shares, ...rest } = parsed.data;
  const config = await prisma.rentConfig.upsert({
    where: { apartmentId },
    create: { ...rest, apartmentId, shares: JSON.stringify(shares ?? {}) },
    update: { ...rest, shares: JSON.stringify(shares ?? {}) },
  });

  return NextResponse.json(config);
}
