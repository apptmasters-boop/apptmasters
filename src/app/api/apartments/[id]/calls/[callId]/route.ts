import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const { id: apartmentId, callId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const call = await prisma.callSession.findFirst({ where: { id: callId, apartmentId } });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(call);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const { id: apartmentId, callId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const call = await prisma.callSession.findFirst({ where: { id: callId, apartmentId } });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.status) data.status = body.status;
  if (body.status === "ENDED" || body.status === "DECLINED") data.endedAt = new Date();
  if (body.status === "ACTIVE") data.status = "ACTIVE";
  if (body.answer) data.answer = body.answer;

  // ICE candidates — append to the right side
  if (body.iceCandidate) {
    const isCallee = call.callerId !== payload.userId;
    const field = isCallee ? "receiverIce" : "callerIce";
    const existing: unknown[] = JSON.parse((call as unknown as Record<string, string>)[field] || "[]");
    existing.push(body.iceCandidate);
    data[field] = JSON.stringify(existing);
  }

  const updated = await prisma.callSession.update({ where: { id: callId }, data });
  return NextResponse.json(updated);
}
