import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

async function getOrCreateFund(apartmentId: string) {
  let fund = await prisma.apartmentFund.findUnique({ where: { apartmentId } });
  if (!fund) {
    fund = await prisma.apartmentFund.create({ data: { apartmentId } });
  }
  return fund;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fund = await getOrCreateFund(apartmentId);
  const transactions = await prisma.fundTransaction.findMany({
    where: { apartmentId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ balance: fund.balance, transactions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, amount, description } = await req.json();
  if (!type || !amount || !description) return NextResponse.json({ error: "type, amount, description required" }, { status: 400 });
  if (!["CONTRIBUTION", "WITHDRAWAL"].includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const fund = await getOrCreateFund(apartmentId);

  if (type === "WITHDRAWAL" && fund.balance < amount) {
    return NextResponse.json({ error: "Insufficient fund balance" }, { status: 400 });
  }

  const delta = type === "CONTRIBUTION" ? amount : -amount;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  const [updatedFund, transaction] = await prisma.$transaction([
    prisma.apartmentFund.update({
      where: { apartmentId },
      data: { balance: { increment: delta } },
    }),
    prisma.fundTransaction.create({
      data: { fundId: fund.id, apartmentId, userId: payload.userId, type, amount, description },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  await notifyApartment(
    apartmentId,
    payload.userId,
    type === "CONTRIBUTION" ? "EXPENSE_ADDED" : "FUND_LOW",
    type === "CONTRIBUTION" ? "Apartment fund contribution" : "Apartment fund withdrawal",
    `${user?.name} ${type === "CONTRIBUTION" ? "added" : "withdrew"} $${amount.toFixed(2)} — ${description}. New balance: $${updatedFund.balance.toFixed(2)}`,
    `/apartment/${apartmentId}/fund`,
  );

  return NextResponse.json({ balance: updatedFund.balance, transaction }, { status: 201 });
}
