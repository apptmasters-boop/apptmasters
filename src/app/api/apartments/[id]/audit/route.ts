import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!member || member.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { apartmentId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}
