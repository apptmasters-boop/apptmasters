import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

const schema = z.object({
  reason: z.enum(["SPAM", "SCAM", "BROKER_FEE_DEMANDED", "ALREADY_RENTED", "INAPPROPRIATE", "OTHER"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: listingId } = await params;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.listingReport.findFirst({
    where: { listingId, reportedById: payload.userId, status: "OPEN" },
  });
  if (existing) return NextResponse.json({ error: "You've already reported this listing." }, { status: 409 });

  const report = await prisma.listingReport.create({
    data: {
      listingId,
      reportedById: payload.userId,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
