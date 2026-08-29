import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.listing.findMany({
    where: { ownerId: payload.userId },
    orderBy: { createdAt: "desc" },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });

  return NextResponse.json(listings);
}
