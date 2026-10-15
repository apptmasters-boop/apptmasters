import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { buildHomeFeed } from "@/lib/homeFeed";
import { ensureRentMonths } from "@/lib/rent";

// Everything the Home page needs in one request: the priority feed
// (src/lib/homeFeed.ts) plus the household announcement and names.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  // A month's rent starts by itself when it's coming due (Sprint 7b), even if the daily job didn't run.
  await ensureRentMonths(apartmentId);

  const [apartment, me, items] = await Promise.all([
    prisma.apartment.findUnique({ where: { id: apartmentId }, select: { name: true, announcement: true, announcementAt: true } }),
    prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } }),
    buildHomeFeed(apartmentId, access.userId, access.membership.role),
  ]);

  return NextResponse.json({
    apartmentName: apartment?.name ?? "",
    announcement: apartment?.announcement ? { text: apartment.announcement, at: apartment.announcementAt } : null,
    firstName: me?.name.split(" ")[0] ?? "",
    items,
  });
}
