import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { defaultSplit, equalSplits } from "@/lib/expenses";

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
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const expenses = await prisma.expense.findMany({
    where: { apartmentId },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
      settlements: { select: { fromUserId: true, method: true } },
    },
    orderBy: { date: "desc" },
  });

  // Attach each split's actual settlement method (if paid) — Settlement isn't
  // directly keyed to a split, so match it by who paid within this expense.
  const withSplitMethods = expenses.map(({ settlements, ...expense }) => ({
    ...expense,
    splits: expense.splits.map(split => ({
      ...split,
      method: settlements.find(s => s.fromUserId === split.userId)?.method ?? null,
    })),
  }));

  return NextResponse.json(withSplitMethods);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;
  const payload = { userId: access.userId, email: access.email };

  const membership = access.membership;
  if (!membership || membership.role === "GUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { customSplits, perPersonAmounts, date, receiptUrl, ...rest } = parsed.data;

  // Equal splits leave out members who are away (never the payer); same rules as a shopping trip.
  let splits: { userId: string; amount: number }[] = [];
  if (rest.splitMethod === "EQUAL") {
    splits = equalSplits(rest.amount, await defaultSplit(apartmentId, payload.userId), payload.userId);
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
