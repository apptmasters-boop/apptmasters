import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> },
) {
  const { id: apartmentId, disputeId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { status, resolution } = await req.json().catch(() => ({}));
  if (!["RESOLVED", "DISMISSED"].includes(status)) {
    return NextResponse.json({ error: "status must be RESOLVED or DISMISSED" }, { status: 400 });
  }

  const dispute = await prisma.dispute.update({
    where: { id: disputeId },
    data: { status, resolution: resolution || null, resolvedAt: new Date() },
    include: { raisedBy: { select: { id: true, name: true } } },
  });

  await notifyApartment(
    apartmentId, payload.userId, "EXPENSE_ADDED",
    `Dispute ${status.toLowerCase()}`,
    `"${dispute.title}" was ${status.toLowerCase()}`,
    `/apartment/${apartmentId}/disputes`,
  );

  return NextResponse.json(dispute);
}
