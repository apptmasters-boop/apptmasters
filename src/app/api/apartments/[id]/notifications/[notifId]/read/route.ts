import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; notifId: string }> }) {
  const { id: apartmentId, notifId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { id: notifId, apartmentId, userId: payload.userId },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
