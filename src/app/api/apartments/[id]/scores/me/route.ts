import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  const { visibility } = await req.json().catch(() => ({}));
  if (!["EXACT", "TIER", "PRIVATE"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }

  const score = await prisma.roommateScore.upsert({
    where: { userId_apartmentId: { userId, apartmentId } },
    create: { userId, apartmentId, visibility },
    update: { visibility },
  });

  return NextResponse.json(score);
}
