import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = member.role === "ADMIN";

  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: { not: "MOVED_OUT" } },
    include: { user: { select: { id: true, name: true } } },
  });

  const scores = await prisma.roommateScore.findMany({
    where: { apartmentId },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  const scoreMap = Object.fromEntries(scores.map(s => [s.userId, s]));

  const result = members.map(m => {
    const s = scoreMap[m.userId];
    const score = s?.score ?? 50;
    const visibility = s?.visibility ?? "TIER";
    const isSelf = m.userId === payload.userId;

    let displayScore: number | null = null;
    let tier = scoreTier(score);

    if (isSelf || isAdmin || visibility === "EXACT") {
      displayScore = score;
    } else if (visibility === "TIER") {
      displayScore = null; // only tier shown
    } else {
      // PRIVATE — only self/admin see it, already handled above
      tier = "Private";
    }

    return {
      userId: m.userId,
      name: m.user.name,
      score: displayScore,
      tier,
      visibility,
      isSelf,
      logs: isSelf || isAdmin ? (s?.logs ?? []) : [],
    };
  });

  return NextResponse.json(result);
}

function scoreTier(score: number): string {
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}
