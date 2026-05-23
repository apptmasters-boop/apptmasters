import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; choreId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, choreId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const chore = await prisma.chore.findUnique({
    where: { id: choreId },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  if (!chore) return NextResponse.json({ error: "Chore not found" }, { status: 404 });

  // In-app nudge — logged as a notification (email/push to be wired in Phase 4)
  return NextResponse.json({
    nudged: true,
    assignee: chore.assignedTo?.name ?? "Unassigned",
    chore: chore.title,
  });
}
