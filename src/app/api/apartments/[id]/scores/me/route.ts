import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { visibility } = await req.json().catch(() => ({}));
  if (!["EXACT", "TIER", "PRIVATE"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const score = await prisma.roommateScore.upsert({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
    create: { userId: payload.userId, apartmentId, visibility },
    update: { visibility },
  });

  return NextResponse.json(score);
}
