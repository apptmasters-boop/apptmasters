import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id: apartmentId, ruleId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };


  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const ack = await prisma.houseRuleAcknowledgment.upsert({
    where: { userId_houseRuleId: { userId: payload.userId, houseRuleId: ruleId } },
    create: { userId: payload.userId, houseRuleId: ruleId },
    update: { acknowledgedAt: new Date() },
  });

  return NextResponse.json(ack);
}
