import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; notifId: string }> }) {
  const { id: apartmentId, notifId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const { userId } = access;

  await prisma.notification.updateMany({
    where: { id: notifId, apartmentId, userId },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
