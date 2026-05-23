import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ content: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const lastRule = await prisma.houseRule.findFirst({
    where: { apartmentId, archivedAt: null },
    orderBy: { version: "desc" },
  });

  const rule = await prisma.houseRule.create({
    data: {
      content: parsed.data.content,
      apartmentId,
      version: (lastRule?.version ?? 0) + 1,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
