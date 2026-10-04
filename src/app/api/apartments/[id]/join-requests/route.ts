import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };


  const caller = access.membership;
  if (!caller || caller.status !== "ACTIVE" || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pending = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "PENDING_APPROVAL" },
    include: { user: { select: { id: true, name: true, email: true, photo: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(pending);
}
