import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFilters, searchWhere, searchOrderBy, kindCounts } from "@/lib/listingSearch";
import { listingCardQuery } from "@/lib/listingCards";

const PAGE_SIZE = 24;

/**
 * Find a Home search (Sprint 12; docs/MARKETPLACE_FLOW.md §3–§7). Public: no
 * account needed to search (§2). Returns one page of matching listings, how
 * many match in all, and how many each tab holds (apartments, rooms, houses;
 * Sprint 13c). The advertiser is their first name, member-since date and
 * profile photo (never their email).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Math.min(Number(params.get("page")) || 1, 100));

  // The tab counts ignore the tab (and the older place-type filter), so every tab shows what it would hold.
  const where = searchWhere(filters);
  const anyKind = searchWhere({ ...filters, type: "", kind: "" });
  const [listings, total, groups] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: searchOrderBy(filters), skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, ...listingCardQuery }),
    prisma.listing.count({ where }),
    prisma.listing.groupBy({ by: ["type", "propertyType"], where: anyKind, _count: { _all: true } }),
  ]);
  const kinds = kindCounts(groups);

  return NextResponse.json({
    listings: listings.map(l => ({ ...l, owner: { id: l.owner.id, name: l.owner.name.split(" ")[0], since: l.owner.createdAt, photo: l.owner.photo } })),
    total,
    counts: { ...kinds, APARTMENT_FOR_RENT: kinds.apartment + kinds.house, ROOM_TO_SHARE: kinds.room },
    page,
    pageSize: PAGE_SIZE,
  });
}
