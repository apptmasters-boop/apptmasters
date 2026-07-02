import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, systemRole: true, createdAt: true,
      memberships: { include: { apartment: { select: { id: true, name: true } } } },
      directMessagesSent: { orderBy: { createdAt: "desc" }, take: 500 },
      expensesPaid: { orderBy: { createdAt: "desc" } },
      disputesRaised: { orderBy: { createdAt: "desc" } },
      disputesAgainst: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  logAudit({
    action: "LEGAL_EXPORT",
    entityType: "user",
    entityId: id,
    meta: { exportedBy: payload.email, reason: "admin_request" },
    userId: payload.userId,
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    exportedBy: payload.email,
    user,
  });
}
