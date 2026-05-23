import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, ruleId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const ack = await prisma.houseRuleAcknowledgment.upsert({
    where: { userId_houseRuleId: { userId: payload.userId, houseRuleId: ruleId } },
    create: { userId: payload.userId, houseRuleId: ruleId },
    update: { acknowledgedAt: new Date() },
  });

  return NextResponse.json(ack);
}
