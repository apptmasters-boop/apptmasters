import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTokenFromRequest, requireSuperAdmin } from "@/lib/auth";

const editSchema = z.object({
  type: z.enum(["APARTMENT_FOR_RENT", "ROOM_TO_SHARE"]),
  title: z.string().min(1, "Title is required").max(120, "Title is too long"),
  description: z.string().min(1, "Description is required").max(4000, "Description is too long"),
  price: z.number().positive("Enter a valid price"),
  priceMax: z.number().positive().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  address: z.string().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  availableFrom: z.string().optional(),
  leaseLength: z.string().optional(),
  roommateGenderPref: z.enum(["ANY", "MALE", "FEMALE"]).optional(),
  roommateAgeMin: z.number().int().min(0).optional(),
  roommateAgeMax: z.number().int().min(0).optional(),
  roommateOccupation: z.enum(["STUDENT", "PROFESSIONAL", "EITHER"]).optional(),
  roommateSmoking: z.enum(["NO", "YES", "EITHER"]).optional(),
  roommatePets: z.enum(["NO", "YES", "EITHER"]).optional(),
  roommateLifestyleTags: z.array(z.string()).optional(),
  roommateCulturalNotes: z.string().optional(),
  photoUrls: z.array(z.string()).min(1, "At least one photo is required").max(8, "Maximum 8 photos"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing.status !== "APPROVED") {
    const payload = getTokenFromRequest(req);
    const isOwner = payload?.userId === listing.ownerId;
    const isAdmin = payload ? await requireSuperAdmin(req) : null;
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(listing);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Owner-initiated "mark as rented" — the only status transition a non-admin can make directly
  if (body.action === "MARK_REMOVED") {
    if (listing.status === "REMOVED") return NextResponse.json(listing);
    const updated = await prisma.listing.update({ where: { id }, data: { status: "REMOVED" } });
    return NextResponse.json(updated);
  }

  if (listing.status === "REMOVED") {
    return NextResponse.json({ error: "This listing was removed. Create a new listing to relist." }, { status: 400 });
  }

  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  // Editing an APPROVED listing sends it back for re-review; a PENDING or
  // REJECTED listing just updates in place (a REJECTED edit-and-save IS the resubmit flow).
  const nextStatus = listing.status === "APPROVED" ? "PENDING" : listing.status === "REJECTED" ? "PENDING" : listing.status;

  await prisma.listingPhoto.deleteMany({ where: { listingId: id } });

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      price: data.price,
      priceMax: data.priceMax ?? null,
      city: data.city,
      state: data.state ?? null,
      address: data.address ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
      leaseLength: data.leaseLength ?? null,
      roommateGenderPref: data.type === "ROOM_TO_SHARE" ? data.roommateGenderPref ?? null : null,
      roommateAgeMin: data.type === "ROOM_TO_SHARE" ? data.roommateAgeMin ?? null : null,
      roommateAgeMax: data.type === "ROOM_TO_SHARE" ? data.roommateAgeMax ?? null : null,
      roommateOccupation: data.type === "ROOM_TO_SHARE" ? data.roommateOccupation ?? null : null,
      roommateSmoking: data.type === "ROOM_TO_SHARE" ? data.roommateSmoking ?? null : null,
      roommatePets: data.type === "ROOM_TO_SHARE" ? data.roommatePets ?? null : null,
      roommateLifestyleTags: data.type === "ROOM_TO_SHARE" ? JSON.stringify(data.roommateLifestyleTags ?? []) : "[]",
      roommateCulturalNotes: data.type === "ROOM_TO_SHARE" ? data.roommateCulturalNotes ?? null : null,
      status: nextStatus,
      rejectionReason: nextStatus === "PENDING" ? null : listing.rejectionReason,
      reviewedAt: nextStatus === "PENDING" ? null : listing.reviewedAt,
      reviewedById: nextStatus === "PENDING" ? null : listing.reviewedById,
      photos: { create: data.photoUrls.map((url, i) => ({ url, position: i })) },
    },
    include: { photos: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = listing.ownerId === payload.userId;
  const isAdmin = await requireSuperAdmin(req);
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
