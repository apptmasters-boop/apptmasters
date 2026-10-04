import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { notify } from "@/lib/notify";

// POST = admin rejects a pending out-of-turn advance request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rotationId: string }> }
) {
  const { id: apartmentId, rotationId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const caller = access.membership;
  if (!caller || caller.status !== "ACTIVE" || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rotation = await prisma.cleaningRotation.findUnique({ where: { id: rotationId } });
  if (!rotation || rotation.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!rotation.pendingAdvanceById) {
    return NextResponse.json({ error: "No pending request for this rotation." }, { status: 404 });
  }

  const requesterId = rotation.pendingAdvanceById;

  await prisma.cleaningRotation.update({
    where: { id: rotationId },
    data: {
      pendingAdvanceById: null,
      pendingAdvancePhotoUrl: null,
      pendingAdvanceNotes: null,
      pendingAdvanceAt: null,
    },
  });

  await notify({
    apartmentId,
    userIds: [requesterId],
    type: "ROTATION_ADVANCE_REQUEST",
    title: "Rotation advance declined",
    body: "Your request to advance the cleaning rotation was declined by an admin.",
    link: `/apartment/${apartmentId}/cleaning`,
    sendEmailTo: [requesterId],
  });

  return NextResponse.json({ rejected: true });
}
