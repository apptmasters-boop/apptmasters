import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adjustScore } from "@/lib/score";

const schema = z.object({
  status: z.enum(["PAID", "CONFIRMED"]),
  method: z.enum(["VENMO", "PAYPAL", "CASHAPP", "CASH", "BANK"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cycleId: string; paymentId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cycleId, paymentId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const payment = await prisma.rentPayment.findUnique({
    where: { id: paymentId },
    include: { rentCycle: true },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the payer can mark as PAID; only the rent payer can CONFIRM
  if (parsed.data.status === "PAID" && payment.userId !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.status === "CONFIRMED" && payment.rentCycle.rentPayerId !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.rentPayment.update({
    where: { id: paymentId },
    data: {
      status: parsed.data.status,
      method: parsed.data.method,
      ...(parsed.data.status === "PAID" ? { paidAt: new Date() } : {}),
      ...(parsed.data.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  // Award score points when rent payment is confirmed
  if (parsed.data.status === "CONFIRMED") {
    const { id: apartmentId } = await params;
    await adjustScore(payment.userId, apartmentId, 5, "Rent payment confirmed").catch(() => {});
  }

  return NextResponse.json(updated);
}
