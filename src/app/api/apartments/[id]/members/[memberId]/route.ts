import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).optional(),
  status: z.enum(["ACTIVE", "VACATION", "MOVED_OUT"]).optional(),
});

async function requireAdmin(userId: string, apartmentId: string) {
  const m = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId, apartmentId } },
  });
  return m?.role === "ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, memberId } = await params;
  const isAdmin = await requireAdmin(payload.userId, apartmentId);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const member = await prisma.apartmentMember.findUnique({ where: { id: memberId } });
  if (!member || member.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const updated = await prisma.apartmentMember.update({
    where: { id: memberId },
    data: {
      ...parsed.data,
      movedOutAt: parsed.data.status === "MOVED_OUT" ? new Date() : undefined,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, memberId } = await params;
  const isAdmin = await requireAdmin(payload.userId, apartmentId);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await prisma.apartmentMember.findUnique({ where: { id: memberId } });
  if (!member || member.apartmentId !== apartmentId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Guard: if the member being removed is an admin, ensure at least one admin remains
  if (member.role === "ADMIN") {
    const allMembers = await prisma.apartmentMember.findMany({
      where: { apartmentId, status: { not: "MOVED_OUT" } },
    });
    const otherMembers = allMembers.filter(m => m.id !== memberId);

    if (otherMembers.length === 0) {
      return NextResponse.json(
        { error: "You are the only member in this apartment and cannot leave." },
        { status: 409 }
      );
    }

    const remainingAdmins = otherMembers.filter(m => m.role === "ADMIN");
    if (remainingAdmins.length === 0) {
      return NextResponse.json(
        { error: "You must assign the admin role to another member before leaving." },
        { status: 409 }
      );
    }
  }

  await prisma.apartmentMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
