import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

const schema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().default("GENERAL"),
  splitMethod: z.enum(["EQUAL", "CUSTOM", "PER_PERSON"]).default("EQUAL"),
  customSplits: z.record(z.string(), z.number()).optional(), // { userId: amount }
  perPersonAmounts: z.record(z.string(), z.number()).optional(),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  notes: z.string().optional(),
  receiptUrl: z.string().optional(),
  date: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const expenses = await prisma.expense.findMany({
    where: { apartmentId },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { customSplits, perPersonAmounts, date, receiptUrl, ...rest } = parsed.data;

  // Determine splits
  const activeMembers = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    select: { userId: true },
  });
  const allMemberIds = activeMembers.map(m => m.userId);

  // Exclude currently-traveling members (except the payer) from EQUAL splits
  const now = new Date();
  const travelers = await prisma.travelPeriod.findMany({
    where: {
      apartmentId,
      startDate: { lte: now },
      returnedAt: null,
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      userId: { not: payload.userId }, // never skip payer
    },
    select: { userId: true },
  });
  const travelingIds = new Set(travelers.map(t => t.userId));
  const memberIds = allMemberIds.filter(uid => !travelingIds.has(uid));

  let splits: { userId: string; amount: number }[] = [];
  if (rest.splitMethod === "EQUAL") {
    const share = parseFloat((rest.amount / memberIds.length).toFixed(2));
    splits = memberIds.map(userId => ({ userId, amount: userId === payload.userId ? 0 : share }));
  } else if (rest.splitMethod === "CUSTOM" && customSplits) {
    splits = Object.entries(customSplits)
      .filter(([uid]) => uid !== payload.userId)
      .map(([userId, amount]) => ({ userId, amount }));
  } else if (rest.splitMethod === "PER_PERSON" && perPersonAmounts) {
    splits = Object.entries(perPersonAmounts)
      .filter(([uid]) => uid !== payload.userId)
      .map(([userId, amount]) => ({ userId, amount }));
  }

  const expense = await prisma.expense.create({
    data: {
      ...rest,
      apartmentId,
      paidById: payload.userId,
      ...(date ? { date: new Date(date) } : {}),
      ...(receiptUrl ? { receiptUrl } : {}),
      splits: { create: splits },
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  const othersInSplit = splits.map(s => s.userId).filter(uid => uid !== payload.userId);
  if (othersInSplit.length > 0) {
    notify({
      apartmentId,
      userIds: othersInSplit,
      type: "EXPENSE_ADDED",
      title: `New expense: ${rest.title}`,
      body: `${expense.paidBy.name} added a $${rest.amount.toFixed(2)} expense split between you.`,
      link: `/apartment/${apartmentId}/finance`,
      sendEmailTo: othersInSplit,
    }).catch(() => {});
  }

  return NextResponse.json(expense, { status: 201 });
}
