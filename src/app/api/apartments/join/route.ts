import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  inviteCode: z.string().min(1),
  role: z.enum(["MEMBER", "GUEST"]).optional().default("MEMBER"),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const apartment = await prisma.apartment.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
  });
  if (!apartment) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  const existing = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: apartment.id } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  // New member must acknowledge active house rules before joining
  const activeRules = await prisma.houseRule.findMany({
    where: { apartmentId: apartment.id, archivedAt: null },
  });

  const member = await prisma.apartmentMember.create({
    data: { userId: payload.userId, apartmentId: apartment.id, role: parsed.data.role },
    include: { apartment: true },
  });

  return NextResponse.json({ member, pendingRules: activeRules }, { status: 201 });
}
