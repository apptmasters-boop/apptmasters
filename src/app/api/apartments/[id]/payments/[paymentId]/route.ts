import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { respondToPayment, PaymentError } from "@/lib/payments";

/** POST { action: confirm | decline } (the person paid) or { action: cancel } (the payer). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id: apartmentId, paymentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const { action } = await req.json().catch(() => ({}));
  if (!["confirm", "decline", "cancel"].includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  try {
    const payment = await respondToPayment(apartmentId, paymentId, access.userId, action);
    if (action !== "cancel") {
      const receiver = await prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } });
      const name = receiver?.name ?? "Someone";
      await notify({
        apartmentId, userIds: [payment.fromUserId], type: action === "confirm" ? "PAYMENT_CONFIRMED" : "PAYMENT_DECLINED",
        title: action === "confirm" ? `${name} confirmed your payment of $${payment.amount.toFixed(2)}` : `${name} didn't confirm your payment of $${payment.amount.toFixed(2)}`,
        body: action === "confirm" ? "It's marked as paid in Money." : "What it covered is still owed. Talk to them, then record it again.",
        link: `/apartment/${apartmentId}/money`,
      });
    }
    return NextResponse.json(payment);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
