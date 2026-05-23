import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const { id: apartmentId, ruleId } = await params;
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (member?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const rule = await prisma.houseRule.findFirst({ where: { id: ruleId, apartmentId } });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.houseRule.update({ where: { id: ruleId }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
