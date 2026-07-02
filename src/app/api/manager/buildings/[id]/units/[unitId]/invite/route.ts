import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, landlordInviteEmail, appUrl } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  const { id: buildingId, unitId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, buildingId, building: { managerId: payload.userId } },
    include: { building: { select: { name: true } } },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.unitInvite.create({
    data: { email: parsed.data.email, unitId, expiresAt },
  });

  const inviteUrl = `${appUrl}/invite/${invite.token}`;
  await sendEmail(
    parsed.data.email,
    `You're invited to Unit ${unit.number} at ${unit.building.name}`,
    landlordInviteEmail(unit.building.name, unit.number, inviteUrl)
  );

  return NextResponse.json({ success: true, inviteUrl });
}
