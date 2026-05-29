import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite";

const createSchema = z.object({ name: z.string().min(1) });

export async function GET(req: NextRequest) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apartments = await prisma.apartment.findMany({
    where: { managerId: payload.userId },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apartments);
}

export async function POST(req: NextRequest) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let inviteCode = generateInviteCode();
  while (await prisma.apartment.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode();
  }

  const apartment = await prisma.apartment.create({
    data: { name: parsed.data.name, inviteCode, managerId: payload.userId },
  });

  return NextResponse.json(apartment, { status: 201 });
}
