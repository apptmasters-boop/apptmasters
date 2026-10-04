import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notifyApartment } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> },
) {
  const { id: apartmentId, disputeId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const admin = access.membership;
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
    apartmentId, payload.userId, status === "RESOLVED" ? "DISPUTE_RESOLVED" : "DISPUTE_DISMISSED",
    `Dispute ${status.toLowerCase()}`,
    `"${dispute.title}" was ${status.toLowerCase()}`,
    `/apartment/${apartmentId}/disputes`,
  );

  logAudit({ action: `DISPUTE_${status}`, entityType: "dispute", entityId: disputeId,
    meta: { title: dispute.title, resolution: resolution || null },
    userId: payload.userId, apartmentId });

  return NextResponse.json(dispute);
}
