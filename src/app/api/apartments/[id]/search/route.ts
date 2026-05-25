import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ chores: [], expenses: [], events: [], members: [], grocery: [], inventory: [] });

  const like = { contains: q };

  const [chores, expenses, events, members, grocery, inventory] = await Promise.all([
    prisma.chore.findMany({
      where: { apartmentId, title: like },
      select: { id: true, title: true, status: true, dueDate: true, assignedTo: { select: { name: true } } },
      take: 8,
    }),
    prisma.expense.findMany({
      where: { apartmentId, OR: [{ title: like }, { notes: like }] },
      select: { id: true, title: true, amount: true, category: true, status: true, notes: true },
      take: 8,
    }),
    prisma.calendarEvent.findMany({
      where: { apartmentId, OR: [{ title: like }, { notes: like }] },
      select: { id: true, title: true, type: true, startDate: true, notes: true },
      take: 8,
    }),
    prisma.apartmentMember.findMany({
      where: {
        apartmentId,
        status: { not: "MOVED_OUT" },
        user: { OR: [{ name: like }, { email: like }] },
      },
      include: { user: { select: { id: true, name: true, email: true, roomAssignment: true } } },
      take: 8,
    }),
    prisma.groceryItem.findMany({
      where: { apartmentId, name: like },
      select: { id: true, name: true, quantity: true, purchased: true, addedBy: { select: { name: true } } },
      take: 8,
    }),
    prisma.inventoryItem.findMany({
      where: { apartmentId, OR: [{ name: like }, { notes: like }] },
      select: { id: true, name: true, category: true, quantity: true, unit: true },
      take: 8,
    }),
  ]);

  return NextResponse.json({ chores, expenses, events, members, grocery, inventory });
}
