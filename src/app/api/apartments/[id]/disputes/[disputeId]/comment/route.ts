import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> },
) {
  const { id: apartmentId, disputeId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await req.json().catch(() => ({}));
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });

  const dispute = await prisma.dispute.findFirst({ where: { id: disputeId, apartmentId } });
  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (dispute.status !== "OPEN") return NextResponse.json({ error: "Dispute is closed" }, { status: 400 });

  const comment = await prisma.disputeComment.create({
    data: { disputeId, userId: payload.userId, body },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
