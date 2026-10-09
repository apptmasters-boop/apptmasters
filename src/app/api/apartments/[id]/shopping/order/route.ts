import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentAdmin } from "@/lib/access";
import { shoppingTurn } from "@/lib/shopping";

/**
 * Household admins set the shopping order. Body: { memberIds }: everyone who
 * takes part, each once. The first person in the new order shops next.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentAdmin(req, apartmentId);
  if (!access.ok) return access.response;

  const { memberIds } = await req.json().catch(() => ({}));
  const turn = await shoppingTurn(apartmentId, { save: true });
  if (turn.trip) return NextResponse.json({ error: "Wait until the current trip is finished" }, { status: 409 });

  const ids: unknown[] = Array.isArray(memberIds) ? memberIds : [];
  const sameMembers = ids.length === turn.order.length && new Set(ids).size === ids.length
    && ids.every(id => typeof id === "string" && turn.order.includes(id));
  if (!sameMembers) return NextResponse.json({ error: "The order must list everyone who shops, once each" }, { status: 400 });

  await prisma.shoppingRotation.update({ where: { apartmentId }, data: { memberOrder: JSON.stringify(ids), currentIndex: 0 } });
  return NextResponse.json({ ok: true });
}
