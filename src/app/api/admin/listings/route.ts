import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");
  const reportedOnly = req.nextUrl.searchParams.get("reported") === "true";

  const listings = await prisma.listing.findMany({
    where: {
      ...(reportedOnly
        ? { reports: { some: { status: "OPEN" } } }
        : { status: status ?? "PENDING" }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1 },
      owner: { select: { id: true, name: true, email: true } },
      reports: { where: { status: "OPEN" }, include: { reportedBy: { select: { name: true } } } },
    },
  });

  return NextResponse.json(listings);
}
