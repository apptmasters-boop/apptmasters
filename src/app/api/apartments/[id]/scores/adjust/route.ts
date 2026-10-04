import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { adjustScore } from "@/lib/score";
import { notifyApartment } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const admin = access.membership;
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { userId, delta, reason } = await req.json().catch(() => ({}));
  if (!userId || delta === undefined || !reason) {
    return NextResponse.json({ error: "userId, delta, and reason required" }, { status: 400 });
  }

  await adjustScore(userId, apartmentId, delta, reason);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  await notifyApartment(
    apartmentId,
    payload.userId,
    "SCORE_ADJUSTED",
    "Roommate score updated",
    `${admin?.role === "ADMIN" ? "An admin" : "A roommate"} adjusted ${target?.name ?? "someone"}'s score by ${delta > 0 ? "+" : ""}${delta} points: ${reason}`,
    `/apartment/${apartmentId}/scores`,
  );

  return NextResponse.json({ ok: true });
}
