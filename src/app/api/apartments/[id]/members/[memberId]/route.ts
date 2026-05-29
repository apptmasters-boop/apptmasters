import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

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

  if (parsed.data.role) {
    logAudit({ action: "ROLE_CHANGED", entityType: "member", entityId: memberId,
      meta: { targetUser: updated.user.name, newRole: parsed.data.role },
      userId: payload.userId, apartmentId });
  }
  if (parsed.data.status) {
    logAudit({ action: "STATUS_CHANGED", entityType: "member", entityId: memberId,
      meta: { targetUser: updated.user.name, newStatus: parsed.data.status },
      userId: payload.userId, apartmentId });

    // Move-out automation
    if (parsed.data.status === "MOVED_OUT") {
      const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { name: true } });
      const moveOutUrl = `${appUrl}/apartment/${apartmentId}/moveout/${updated.user.id}`;

      // Email the member their move-out report link
      sendEmail(
        updated.user.email,
        `Your move-out summary — ${apt?.name}`,
        notificationEmail(
          `You've been marked as moved out from ${apt?.name}`,
          "Your move-out report is ready. It includes your final balance, rent history, and expense splits.",
          moveOutUrl, "View move-out report"
        )
      ).catch(() => {});

      // Notify apartment admins
      const admins = await prisma.apartmentMember.findMany({
        where: { apartmentId, role: "ADMIN", status: { not: "MOVED_OUT" } },
        select: { userId: true },
      });
      const adminIds = admins.map(a => a.userId).filter(id => id !== updated.user.id);
      if (adminIds.length > 0) {
        notify({
          apartmentId,
          userIds: adminIds,
          type: "MEMBER_MOVED_OUT",
          title: `${updated.user.name} has moved out`,
          body: `Their move-out report is now available.`,
          link: `/apartment/${apartmentId}/moveout/${updated.user.id}`,
        }).catch(() => {});
      }

      logAudit({ action: "MEMBER_MOVED_OUT", entityType: "member", entityId: memberId,
        meta: { targetUser: updated.user.name },
        userId: payload.userId, apartmentId });
    }
  }

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

  const memberUser = await prisma.user.findUnique({ where: { id: member.userId }, select: { name: true } });
  await prisma.apartmentMember.delete({ where: { id: memberId } });
  logAudit({ action: "MEMBER_REMOVED", entityType: "member", entityId: memberId,
    meta: { targetUser: memberUser?.name, wasRole: member.role },
    userId: payload.userId, apartmentId });
  return NextResponse.json({ success: true });
}
