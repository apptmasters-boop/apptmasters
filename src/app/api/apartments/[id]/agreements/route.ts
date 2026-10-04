import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember, requireApartmentAdmin } from "@/lib/access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const agreements = await prisma.sharedAgreement.findMany({
    where: { apartmentId },
    orderBy: { key: "asc" },
  });

  return NextResponse.json(agreements);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentAdmin(req, apartmentId);
  if (!access.ok) return access.response;

  const { key, label, value } = await req.json();
  if (!key || !label || value === undefined) return NextResponse.json({ error: "key, label, value required" }, { status: 400 });

  const agreement = await prisma.sharedAgreement.upsert({
    where: { apartmentId_key: { apartmentId, key } },
    create: { apartmentId, key, label, value },
    update: { label, value },
  });

  return NextResponse.json(agreement);
}
