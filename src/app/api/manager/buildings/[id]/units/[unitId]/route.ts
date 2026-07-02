import { NextRequest, NextResponse } from "next/server";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
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

  await prisma.unit.delete({ where: { id: unitId } });
  return NextResponse.json({ success: true });
}
