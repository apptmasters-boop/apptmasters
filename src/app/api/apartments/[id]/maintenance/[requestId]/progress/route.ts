import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { advanceMaintenance, updaterRole, MaintenanceError } from "@/lib/maintenance";

/**
 * POST { status, note?, scheduledStart?, scheduledEnd?, timeZone? }: a household
 * admin records the landlord's answer, when no landlord is linked to the home
 * (a linked landlord uses the manager portal instead).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id: apartmentId, requestId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, apartmentId }, select: { id: true } });
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  const role = await updaterRole(apartmentId, access.userId, access.membership.role);
  if (role !== "HOUSEHOLD") {
    return NextResponse.json({ error: "Only household admins update requests here, and only when no landlord is linked to the home" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    const updated = await advanceMaintenance(requestId, { userId: access.userId, role }, {
      status: String(body.status ?? ""), note: typeof body.note === "string" ? body.note : null,
      scheduledStart: body.scheduledStart ?? null, scheduledEnd: body.scheduledEnd ?? null,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : null,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof MaintenanceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
