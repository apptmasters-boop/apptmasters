import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Join status (Home Setup, Sprint 11b): my requests waiting for a household admin. */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.apartmentMember.findMany({
    where: { userId: payload.userId, status: "PENDING_APPROVAL" },
    orderBy: { joinedAt: "desc" },
    select: { id: true, role: true, joinedAt: true, moveInDate: true, apartment: { select: { name: true, address: true } } },
  });
  return NextResponse.json(requests.map(r => ({
    id: r.id, role: r.role, requestedAt: r.joinedAt, moveInDate: r.moveInDate,
    homeName: r.apartment.name, homeAddress: r.apartment.address,
  })));
}
