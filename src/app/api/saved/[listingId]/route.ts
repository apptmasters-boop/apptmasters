import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Remove a listing from Saved (Sprint 12; MARKETPLACE_FLOW.md §14). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { listingId } = await params;
  await prisma.savedListing.deleteMany({ where: { userId: payload.userId, listingId } });
  return NextResponse.json({ saved: false });
}
