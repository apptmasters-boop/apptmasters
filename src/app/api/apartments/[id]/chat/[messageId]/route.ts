import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const { id: apartmentId, messageId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, apartmentId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (msg.senderId !== payload.userId && member?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content: "[deleted]", type: "SYSTEM" },
  });

  return NextResponse.json({ ok: true });
}
