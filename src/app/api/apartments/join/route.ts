import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, joinRequestEmail, appUrl } from "@/lib/email";

const schema = z.object({
  inviteCode: z.string().min(1),
  role: z.enum(["MEMBER", "GUEST"]).optional().default("MEMBER"),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const apartment = await prisma.apartment.findUnique({
    where: { inviteCode: parsed.data.inviteCode.toUpperCase() },
  });
  if (!apartment) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  const existing = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: apartment.id } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  // Create member in PENDING_APPROVAL state — apartment admin must approve before access is granted
  await prisma.apartmentMember.create({
    data: { userId: payload.userId, apartmentId: apartment.id, role: parsed.data.role, status: "PENDING_APPROVAL" },
  });

  // Email all active apartment admins about the new join request
  const requester = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const admins = await prisma.apartmentMember.findMany({
    where: { apartmentId: apartment.id, role: "ADMIN", status: "ACTIVE" },
    include: { user: { select: { email: true } } },
  });
  const reviewUrl = `${appUrl}/apartment/${apartment.id}`;
  await Promise.allSettled(
    admins.map(a =>
      sendEmail(
        a.user.email,
        `${requester?.name ?? "Someone"} wants to join ${apartment.name}`,
        joinRequestEmail(requester?.name ?? "Someone", apartment.name, reviewUrl)
      )
    )
  );

  return NextResponse.json({ pending: true, apartmentId: apartment.id, apartmentName: apartment.name }, { status: 201 });
}
