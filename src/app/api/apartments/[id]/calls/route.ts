import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notify } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return any active/ringing call for this user in this apartment,
  // including group calls where receiverId is null.
  const call = await prisma.callSession.findFirst({
    where: {
      apartmentId,
      status: { in: ["RINGING", "ACTIVE"] },
      OR: [
        { callerId: payload.userId },
        { receiverId: payload.userId },
        { receiverId: null },
      ],
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(call);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, receiverId, offer, isEmergency } = await req.json();
  if (!type || !offer) return NextResponse.json({ error: "type and offer required" }, { status: 400 });

  // End any existing active calls
  await prisma.callSession.updateMany({
    where: { apartmentId, callerId: payload.userId, status: { in: ["RINGING", "ACTIVE"] } },
    data: { status: "ENDED", endedAt: new Date() },
  });

  const call = await prisma.callSession.create({
    data: {
      apartmentId,
      callerId: payload.userId,
      receiverId: receiverId ?? null,
      type,
      offer,
      isEmergency: isEmergency ?? false,
    },
  });

  // Notify recipient(s)
  const caller = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  if (receiverId) {
    await notify({
      apartmentId, userIds: [receiverId],
      type: "NUDGE",
      title: `${caller?.name} is calling`,
      body: `${type === "VIDEO" ? "Video" : "Voice"} call — tap to answer`,
      link: `/apartment/${apartmentId}/chat`,
    });
  } else {
    const members = await prisma.apartmentMember.findMany({
      where: { apartmentId, status: { not: "MOVED_OUT" } },
      select: { userId: true },
    });
    await notify({
      apartmentId,
      userIds: members.map(m => m.userId).filter(id => id !== payload.userId),
      type: "NUDGE",
      title: `${caller?.name} started a group call`,
      body: `${type === "VIDEO" ? "Video" : "Voice"} — tap to join`,
      link: `/apartment/${apartmentId}/chat`,
    });
  }

  return NextResponse.json(call, { status: 201 });
}
