import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advanceMaintenance, currentStep, MaintenanceError } from "@/lib/maintenance";

/**
 * Landlord portal (PRODUCT_LOGIC §14.2): the linked landlord moves a request
 * along. Body: { status, note?, scheduledStart?, scheduledEnd?, timeZone? }.
 * A body with only { landlordNote } (older portal) adds a note on the current step.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.maintenanceRequest.findUnique({ where: { id: requestId }, include: { apartment: { select: { managerId: true } } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.apartment.managerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : typeof body.landlordNote === "string" ? body.landlordNote : null;
  try {
    const updated = await advanceMaintenance(requestId, { userId: payload.userId, role: "LANDLORD" }, {
      status: typeof body.status === "string" ? body.status : currentStep(existing.status),
      note, scheduledStart: body.scheduledStart ?? null, scheduledEnd: body.scheduledEnd ?? null,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : null,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof MaintenanceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
