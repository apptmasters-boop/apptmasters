import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, deleteConfirmEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const apartment = await prisma.apartment.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!apartment) return NextResponse.json({ error: "Apartment not found" }, { status: 404 });

  // Invalidate any prior unused OTPs for this apartment
  await prisma.apartmentDeleteCode.updateMany({
    where: { apartmentId: id, used: false },
    data: { used: true },
  });

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.apartmentDeleteCode.create({
    data: { code, expiresAt, userId: payload.userId, apartmentId: id },
  });

  const admin = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, email: true },
  });

  try {
    await sendEmail(
      payload.email,
      `Confirm deletion of "${apartment.name}"`,
      deleteConfirmEmail(admin?.name ?? "Admin", apartment.name, code)
    );
  } catch {
    // Non-fatal — code is still stored; admin can request again if email fails
  }

  return NextResponse.json({ sent: true, expiresAt });
}
