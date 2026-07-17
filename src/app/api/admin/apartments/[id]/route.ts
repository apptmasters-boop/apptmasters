import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ code: z.string().length(6) });

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "6-digit code required" }, { status: 400 });

  // Find valid unused non-expired OTP
  const otpRecord = await prisma.apartmentDeleteCode.findFirst({
    where: { apartmentId: id, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return NextResponse.json({ error: "No valid code found. Request a new one." }, { status: 400 });
  }
  if (otpRecord.code !== parsed.data.code) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  // Mark OTP as used immediately to prevent replay
  await prisma.apartmentDeleteCode.update({ where: { id: otpRecord.id }, data: { used: true } });

  // Load apartment data for archive record before deletion
  const apartment = await prisma.apartment.findUnique({
    where: { id },
    include: {
      manager: { select: { name: true, email: true } },
      members: { where: { status: { notIn: ["MOVED_OUT", "PENDING_APPROVAL"] } } },
    },
  });
  if (!apartment) return NextResponse.json({ error: "Apartment not found" }, { status: 404 });

  const admin = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, email: true },
  });

  // Write archive record (inviteCode as PK — preserved for policy compliance)
  await prisma.archivedApartment.create({
    data: {
      inviteCode: apartment.inviteCode,
      name: apartment.name,
      managerName: apartment.manager?.name ?? null,
      managerEmail: apartment.manager?.email ?? null,
      memberCount: apartment.members.length,
      archivedByName: admin?.name ?? "Super Admin",
      archivedByEmail: admin?.email ?? payload.email,
    },
  });

  // Cascade-delete: all child tables have onDelete: Cascade; AuditLog uses SetNull (preserved)
  await prisma.apartment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
