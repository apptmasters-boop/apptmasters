import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const { id: apartmentId, messageId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, apartmentId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = access.membership;
  if (msg.senderId !== payload.userId && member?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content: "[deleted]", type: "SYSTEM" },
  });

  return NextResponse.json({ ok: true });
}
