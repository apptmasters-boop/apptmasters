import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { confirmFix, MaintenanceError } from "@/lib/maintenance";

/**
 * POST { fixed: boolean, note? }: "Is it fixed?" after the landlord side marks a
 * repair completed (PRODUCT_LOGIC §14.5). For the person who reported it, or a
 * household admin once they've moved out. "Still a problem" needs a note.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id: apartmentId, requestId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, apartmentId }, select: { id: true } });
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.fixed !== "boolean") return NextResponse.json({ error: "Say whether it's fixed" }, { status: 400 });
  try {
    const updated = await confirmFix(requestId, { userId: access.userId, memberRole: access.membership.role }, {
      fixed: body.fixed, note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof MaintenanceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
