import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.loginEvent.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(events);
}
