import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listingCardQuery } from "@/lib/listingCards";

/**
 * Saved listings (Sprint 12; docs/MARKETPLACE_FLOW.md §10, §14, §18). Only for
 * signed-in people; the server checks, not just the buttons (§27). A saved
 * listing that's no longer available stays, with its status (§14).
 * `?ids=1` returns only which listings are saved (for the hearts).
 */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("ids") === "1") {
    const rows = await prisma.savedListing.findMany({ where: { userId: payload.userId }, select: { listingId: true } });
    return NextResponse.json({ ids: rows.map(r => r.listingId) });
  }

  const saved = await prisma.savedListing.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
    include: { listing: listingCardQuery },
  });
  return NextResponse.json(saved.map(s => ({
    savedAt: s.createdAt,
    listing: { ...s.listing, owner: { id: s.listing.owner.id, name: s.listing.owner.name.split(" ")[0], since: s.listing.owner.createdAt } },
  })));
}

const schema = z.object({ listingId: z.string().min(1) });

/** Save a listing (saving it again changes nothing). */
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Only listings people can see can be saved.
  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId }, select: { status: true } });
  if (!listing || listing.status !== "APPROVED") return NextResponse.json({ error: "This listing isn't available" }, { status: 404 });

  await prisma.savedListing.upsert({
    where: { userId_listingId: { userId: payload.userId, listingId: parsed.data.listingId } },
    create: { userId: payload.userId, listingId: parsed.data.listingId },
    update: {},
  });
  return NextResponse.json({ saved: true }, { status: 201 });
}
