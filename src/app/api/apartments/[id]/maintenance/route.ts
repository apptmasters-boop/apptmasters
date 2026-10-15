import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { currentStep, nextSteps, updaterRole, canConfirmFix, activeMemberIds } from "@/lib/maintenance";

const schema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "URGENT"]).default("MEDIUM"),
  location: z.string().trim().max(80).optional(),
  // Only photos uploaded through /api/upload/maintenance-photo.
  photo: z.string().regex(/^\/uploads\/maintenance\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/).optional(),
});

/**
 * Household → Maintenance (PRODUCT_LOGIC §14): every request with its timeline,
 * who updates requests in this home (the linked landlord, or household admins
 * for the landlord), and the room names for "where".
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const [requests, home, rooms, role, here] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where: { apartmentId },
      include: {
        submittedBy: { select: { id: true, name: true } },
        updates: { orderBy: { createdAt: "asc" }, include: { byUser: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.apartment.findUnique({ where: { id: apartmentId }, select: { manager: { select: { name: true } } } }),
    prisma.room.findMany({ where: { apartmentId }, select: { name: true }, orderBy: { name: "asc" } }),
    updaterRole(apartmentId, access.userId, access.membership.role),
    activeMemberIds(apartmentId),
  ]);

  return NextResponse.json({
    me: access.userId,
    /** "HOUSEHOLD" when this person can update requests for the landlord; null otherwise. */
    canUpdate: role,
    landlord: home?.manager ? { name: home.manager.name } : null,
    rooms: rooms.map(r => r.name),
    // `next`: the steps this person can move each request to (none for people who can't update).
    // `canConfirm`: this person answers "Is it fixed?" for it (Sprint 8b).
    requests: requests.map(r => ({
      ...r, status: currentStep(r.status), next: role ? nextSteps(r.status) : [],
      canConfirm: canConfirmFix(r, access.userId, access.membership.role, here),
    })),
  });
}

/** Report a problem: what, details, where, priority, optional photo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Add a title and a description" }, { status: 400 });

  const unit = await prisma.unit.findFirst({ where: { apartmentId } });
  const request = await prisma.maintenanceRequest.create({
    data: {
      ...parsed.data, location: parsed.data.location || null, apartmentId, unitId: unit?.id ?? null, submittedById: access.userId,
      updates: { create: { status: "REPORTED", byRole: "RESIDENT", byUserId: access.userId } },
    },
    include: { submittedBy: { select: { name: true } }, apartment: { select: { managerId: true, manager: { select: { email: true } } } } },
  });

  const what = `${request.submittedBy.name} reported "${parsed.data.title}"${parsed.data.location ? ` (${parsed.data.location})` : ""}.`;
  if (request.apartment.manager?.email) {
    // The landlord is on Apartment Masters: they're told and answer in their portal.
    await sendEmail(
      request.apartment.manager.email,
      `New maintenance request: ${parsed.data.title}`,
      notificationEmail(`New maintenance request (${parsed.data.priority.toLowerCase()})`, `${what} ${parsed.data.description}`, `${appUrl}/manager`, "Open the manager portal"),
    );
  } else {
    // No landlord linked: household admins pass it on and record the answers.
    const admins = await prisma.apartmentMember.findMany({ where: { apartmentId, role: "ADMIN", status: "ACTIVE", userId: { not: access.userId } }, select: { userId: true } });
    await notify({
      apartmentId, userIds: admins.map(a => a.userId), type: "MAINTENANCE_REPORTED", link: `/apartment/${apartmentId}/maintenance`,
      title: `New repair request: ${parsed.data.title}`,
      body: `${what} Tell the landlord, then record their answer in Maintenance.`,
    });
  }

  const { apartment: _apartment, ...result } = request;
  return NextResponse.json(result, { status: 201 });
}
