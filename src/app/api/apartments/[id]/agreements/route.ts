import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agreements = await prisma.sharedAgreement.findMany({
    where: { apartmentId },
    orderBy: { key: "asc" },
  });

  return NextResponse.json(agreements);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: payload.userId } });
  if (member?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { key, label, value } = await req.json();
  if (!key || !label || value === undefined) return NextResponse.json({ error: "key, label, value required" }, { status: 400 });

  const agreement = await prisma.sharedAgreement.upsert({
    where: { apartmentId_key: { apartmentId, key } },
    create: { apartmentId, key, label, value },
    update: { label, value },
  });

  return NextResponse.json(agreement);
}
