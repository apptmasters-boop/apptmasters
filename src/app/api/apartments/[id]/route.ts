import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: id } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, photo: true, roomAssignment: true, moveInDate: true, dietaryFlags: true } } },
        where: { status: { not: "MOVED_OUT" } },
      },
      houseRules: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        include: {
          votes: { include: { user: { select: { id: true, name: true } } } },
          acknowledgments: { select: { userId: true } },
        },
      },
    },
  });

  if (!apartment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...apartment, currentUserRole: membership.role });
}
