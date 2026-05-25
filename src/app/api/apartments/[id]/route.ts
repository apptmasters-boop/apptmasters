import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  announcement: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: id } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, photo: true, roomAssignment: true, moveInDate: true, dietaryFlags: true } } },
        where: { status: { not: "MOVED_OUT" } },
      },
      houseRules: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        include: {
          votes: { include: { user: { select: { id: true, name: true } } } },
          acknowledgments: { select: { userId: true } },
        },
      },
    },
  });

  if (!apartment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...apartment, currentUserRole: membership.role, currentUserId: payload.userId });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: id } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if ("announcement" in parsed.data) {
    data.announcementAt = parsed.data.announcement ? new Date() : null;
  }

  const apartment = await prisma.apartment.update({ where: { id }, data });
  return NextResponse.json(apartment);
}
