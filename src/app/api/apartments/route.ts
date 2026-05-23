import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite";

const schema = z.object({
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let inviteCode = generateInviteCode();
  while (await prisma.apartment.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode();
  }

  const apartment = await prisma.apartment.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      members: {
        create: { userId: payload.userId, role: "ADMIN" },
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, photo: true } } } } },
  });

  return NextResponse.json(apartment, { status: 201 });
}
