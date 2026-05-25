import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const { id: apartmentId, ruleId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rule = await prisma.houseRule.findFirst({ where: { id: ruleId, apartmentId } });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rule.status !== "PROPOSED") return NextResponse.json({ error: "Rule is not in voting" }, { status: 400 });

  const { vote } = await req.json();
  if (!["YES", "NO"].includes(vote)) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });

  await prisma.ruleVote.upsert({
    where: { houseRuleId_userId: { houseRuleId: ruleId, userId: payload.userId } },
    create: { houseRuleId: ruleId, userId: payload.userId, vote },
    update: { vote },
  });

  // Auto-pass: check if majority voted YES (48h window or majority reached)
  const members = await prisma.apartmentMember.count({ where: { apartmentId, status: { not: "MOVED_OUT" } } });
  const votes = await prisma.ruleVote.findMany({ where: { houseRuleId: ruleId } });
  const yesVotes = votes.filter(v => v.vote === "YES").length;
  const majority = Math.floor(members / 2) + 1;

  if (yesVotes >= majority) {
    await prisma.houseRule.update({ where: { id: ruleId }, data: { status: "ACTIVE" } });
    await notifyApartment(
      apartmentId, null, "RULE_ADDED", "House rule passed",
      `"${rule.content}" has been approved by majority vote`,
      `/apartment/${apartmentId}`,
    );
  }

  const updatedVotes = await prisma.ruleVote.findMany({
    where: { houseRuleId: ruleId },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ votes: updatedVotes, yesCount: yesVotes, memberCount: members });
}
