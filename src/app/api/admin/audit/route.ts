import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await prisma.auditLog.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      apartment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(logs);
}
