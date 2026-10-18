import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { housingState, foundHomeHolds } from "@/lib/housing";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true, name: true, email: true, photo: true, systemRole: true, createdAt: true,
      roomAssignment: true, moveInDate: true, dietaryFlags: true, twoFactorEnabled: true, emailVerified: true, foundHomeAt: true,
      intent: true, // the sign-up answer (step O1)
      memberships: {
        include: { apartment: true },
        where: { status: { not: "MOVED_OUT" } },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // "I found a place" no longer holds once they've moved out of a home since saying it.
  if (user.foundHomeAt && user.memberships.length === 0) {
    const left = await prisma.apartmentMember.findFirst({
      where: { userId: user.id, status: "MOVED_OUT", movedOutAt: { not: null } },
      orderBy: { movedOutAt: "desc" },
      select: { movedOutAt: true },
    });
    if (!foundHomeHolds(user.foundHomeAt, left?.movedOutAt ?? null)) user.foundHomeAt = null;
  }
  return NextResponse.json({ ...user, housingState: housingState(user) });
}
