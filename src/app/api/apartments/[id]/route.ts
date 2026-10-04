import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  announcement: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireApartmentMember(req, id);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };


  const membership = access.membership;
  if (!membership || membership.status === "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, photo: true, roomAssignment: true, moveInDate: true, dietaryFlags: true } } },
        where: { status: { notIn: ["MOVED_OUT", "PENDING_APPROVAL"] } },
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
  const { id } = await params;
  const access = await requireApartmentMember(req, id);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
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
