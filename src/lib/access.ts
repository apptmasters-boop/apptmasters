/**
 * Apartment access control: the single place that decides who may touch an
 * apartment's data. Every route under /api/apartments/[id] must call one of
 * these before reading or writing anything.
 *
 * Usage in a route handler:
 *
 *   const access = await requireApartmentMember(req, apartmentId);
 *   if (!access.ok) return access.response;
 *   const { userId, membership } = access;
 *
 * Who counts as a member: anyone with an ApartmentMember row for the apartment
 * whose join request is no longer PENDING_APPROVAL. This matches the rule the
 * apartment details route used before this helper existed, so moved-out and
 * vacationing members keep the read access they already had.
 *
 * Responses: 401 when not signed in, 403 when signed in but not a member (or
 * not an admin, for requireApartmentAdmin).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest, type JwtPayload } from "@/lib/auth";

type Membership = NonNullable<Awaited<ReturnType<typeof prisma.apartmentMember.findUnique>>>;

export type ApartmentAccess =
  | { ok: true; userId: string; email: string; membership: Membership }
  | { ok: false; response: NextResponse };

const deny = (status: 401 | 403, error: string): ApartmentAccess => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

export async function requireApartmentMember(req: NextRequest, apartmentId: string): Promise<ApartmentAccess> {
  return checkApartmentMember(getTokenFromRequest(req), apartmentId);
}

/**
 * The same membership rule for a caller identified some other way, e.g. by a
 * stream ticket (getStreamUser in src/lib/auth.ts). `null` means not signed in.
 */
export async function checkApartmentMember(payload: JwtPayload | null, apartmentId: string): Promise<ApartmentAccess> {
  if (!payload) return deny(401, "Unauthorized");

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.status === "PENDING_APPROVAL") return deny(403, "Not a member");

  return { ok: true, userId: payload.userId, email: payload.email, membership };
}

/**
 * Property-manager access (the /api/manager routes): true when the user is the
 * apartment's assigned manager, or a platform SUPER_ADMIN. Managers do not need
 * to be members of the apartments they manage.
 */
export async function canManageApartment(userId: string, apartmentId: string): Promise<boolean> {
  const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
  if (!apt) return false;
  if (apt.managerId === userId) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return user?.systemRole === "SUPER_ADMIN";
}

/** Same as requireApartmentMember, but the caller must also have the ADMIN role in that apartment. */
export async function requireApartmentAdmin(req: NextRequest, apartmentId: string): Promise<ApartmentAccess> {
  const access = await requireApartmentMember(req, apartmentId);
  if (access.ok && access.membership.role !== "ADMIN") return deny(403, "Only household admins can do this");
  return access;
}
