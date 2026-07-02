import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [totalUsers, totalApartments, totalMessages, totalExpenses] = await Promise.all([
    prisma.user.count(),
    prisma.apartment.count(),
    prisma.directMessage.count(),
    prisma.expense.count(),
  ]);

  return NextResponse.json({ totalUsers, totalApartments, totalMessages, totalExpenses });
}
