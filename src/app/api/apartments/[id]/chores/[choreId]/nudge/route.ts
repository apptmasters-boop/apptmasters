import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

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

  const [chore, fromUser] = await Promise.all([
    prisma.chore.findUnique({
      where: { id: choreId },
      include: { assignedTo: { select: { id: true, name: true } } },
    }),
    prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } }),
  ]);

  if (!chore) return NextResponse.json({ error: "Chore not found" }, { status: 404 });

  const assigneeName = chore.assignedTo?.name ?? "Unassigned";

  if (chore.assignedTo) {
    await notify({
      apartmentId,
      userIds: [chore.assignedTo.id],
      type: "NUDGE",
      title: `${fromUser?.name ?? "Someone"} nudged you`,
      body: `${fromUser?.name ?? "Someone"} nudged you about "${chore.title}"`,
      link: `/apartment/${apartmentId}/rooms`,
    });
  }

  return NextResponse.json({
    nudged: true,
    assignee: assigneeName,
    chore: chore.title,
  });
}
