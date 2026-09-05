import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

const createSchema = z.object({
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

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  const city = params.get("city");
  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");
  const bedrooms = params.get("bedrooms");
  const roommateGenderPref = params.get("roommateGenderPref");
  const roommateOccupation = params.get("roommateOccupation");
  const roommateSmoking = params.get("roommateSmoking");
  const roommatePets = params.get("roommatePets");
  const roommateLifestyleTag = params.get("roommateLifestyleTag");

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (type) where.type = type;
  if (city) {
    where.OR = [
      { city: { contains: city, mode: "insensitive" } },
      { title: { contains: city, mode: "insensitive" } },
    ];
  }
  if (bedrooms) where.bedrooms = Number(bedrooms);
  if (minPrice || maxPrice) {
    where.price = {
      ...(minPrice ? { gte: Number(minPrice) } : {}),
      ...(maxPrice ? { lte: Number(maxPrice) } : {}),
    };
  }
  if (type === "ROOM_TO_SHARE") {
    if (roommateGenderPref) where.roommateGenderPref = roommateGenderPref;
    if (roommateOccupation) where.roommateOccupation = roommateOccupation;
    if (roommateSmoking) where.roommateSmoking = roommateSmoking;
    if (roommatePets) where.roommatePets = roommatePets;
    if (roommateLifestyleTag) where.roommateLifestyleTags = { contains: `"${roommateLifestyleTag}"` };
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      photos: { orderBy: { position: "asc" }, take: 1 },
      owner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(listings);
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const listing = await prisma.listing.create({
    data: {
      type: data.type,
      status: "PENDING",
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
      ownerId: payload.userId,
      photos: {
        create: data.photoUrls.map((url, i) => ({ url, position: i })),
      },
    },
    include: { photos: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json(listing, { status: 201 });
}
