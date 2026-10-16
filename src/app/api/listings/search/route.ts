import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFilters, searchWhere, searchOrderBy } from "@/lib/listingSearch";
import { listingCardQuery } from "@/lib/listingCards";

const PAGE_SIZE = 24;

/**
 * Find a Home search (Sprint 12; docs/MARKETPLACE_FLOW.md §3–§7). Public: no
 * account needed to search (§2). Returns one page of matching listings, how
 * many match in all, and how many of them are whole places or rooms (the tabs).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Math.min(Number(params.get("page")) || 1, 100));

  // The tab counts ignore the place-type filter itself, so every tab shows what it would hold.
  const where = searchWhere(filters);
  const anyType = searchWhere({ ...filters, type: "" });
  const [listings, total, byType] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: searchOrderBy(filters), skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, ...listingCardQuery }),
    prisma.listing.count({ where }),
    prisma.listing.groupBy({ by: ["type"], where: anyType, _count: { _all: true } }),
  ]);
  const count = (type: string) => byType.find(t => t.type === type)?._count._all ?? 0;

  return NextResponse.json({
    listings: listings.map(l => ({ ...l, owner: { id: l.owner.id, name: l.owner.name.split(" ")[0], since: l.owner.createdAt } })),
    total,
    counts: { all: count("APARTMENT_FOR_RENT") + count("ROOM_TO_SHARE"), APARTMENT_FOR_RENT: count("APARTMENT_FOR_RENT"), ROOM_TO_SHARE: count("ROOM_TO_SHARE") },
    page,
    pageSize: PAGE_SIZE,
  });
}
