import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

const setSchema = z.object({ rentAmount: z.number().positive() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const { id: buildingId, unitId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, buildingId, building: { managerId: payload.userId } },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = setSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: { rentAmount: parsed.data.rentAmount },
  });

  if (updated.apartmentId) {
    await prisma.rentConfig.upsert({
      where: { apartmentId: updated.apartmentId },
      update: { totalAmount: parsed.data.rentAmount },
      create: { apartmentId: updated.apartmentId, totalAmount: parsed.data.rentAmount },
    });
  }

  return NextResponse.json(updated);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const { id: buildingId, unitId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, buildingId, building: { managerId: payload.userId } },
    include: {
      building: { select: { name: true } },
      apartment: {
        include: { members: { include: { user: { select: { name: true, email: true } } } } },
      },
    },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!unit.apartment) return NextResponse.json({ error: "Unit has no tenants" }, { status: 400 });

  const tenants = unit.apartment.members.map(m => m.user);
  const portalUrl = `${appUrl}/apartment/${unit.apartment.id}/rent`;

  await Promise.all(tenants.map(tenant =>
    sendEmail(
      tenant.email,
      `Rent reminder — Unit ${unit.number}, ${unit.building.name}`,
      notificationEmail(
        "Rent Reminder",
        `Hi ${tenant.name}, this is a reminder that your rent is due for Unit ${unit.number} at ${unit.building.name}.`,
        portalUrl,
        "View rent portal"
      )
    )
  ));

  return NextResponse.json({ success: true, reminded: tenants.length });
}
