import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { adjustScore } from "@/lib/score";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { userId, delta, reason } = await req.json().catch(() => ({}));
  if (!userId || delta === undefined || !reason) {
    return NextResponse.json({ error: "userId, delta, and reason required" }, { status: 400 });
  }

  await adjustScore(userId, apartmentId, delta, reason);
  return NextResponse.json({ ok: true });
}
