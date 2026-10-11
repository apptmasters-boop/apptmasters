import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { openItems, recordPayment, PaymentError } from "@/lib/payments";

/**
 * GET ?with=<userId>: what you could pay that person now, and what they owe you
 * that can offset it (Money → Balances → Record payment).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const other = req.nextUrl.searchParams.get("with");
  if (!other) return NextResponse.json({ error: "Who are you paying?" }, { status: 400 });
  return NextResponse.json(await openItems(apartmentId, access.userId, other));
}

/** POST { toUserId, owe: [{type, id}], offset?: [{type, id}], method, note? }: record a payment. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  if (access.membership.role === "GUEST") return NextResponse.json({ error: "Guests can't record payments" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const toUserId = typeof body.toUserId === "string" ? body.toUserId : "";
  const items = (list: unknown) => (Array.isArray(list) ? list : [])
    .filter((i): i is { type: "expense" | "rent"; id: string } => !!i && (i.type === "expense" || i.type === "rent") && typeof i.id === "string");

  try {
    const payment = await recordPayment(apartmentId, access.userId, toUserId, {
      owe: items(body.owe), offset: items(body.offset), method: String(body.method ?? ""), note: typeof body.note === "string" ? body.note : null,
    });
    const payer = await prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } });
    await notify({
      apartmentId, userIds: [toUserId], type: "PAYMENT_RECORDED",
      title: `${payer?.name ?? "Someone"} says they paid you $${payment.amount.toFixed(2)}`,
      body: "Confirm it in Money once you've received it.",
      link: `/apartment/${apartmentId}/money`,
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
