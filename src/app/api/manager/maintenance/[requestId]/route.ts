import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  landlordNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: {
      apartment: { include: { manager: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.apartment.managerId !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { ...parsed.data, updatedAt: new Date() },
  });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    const STATUS_LABEL: Record<string, string> = {
      IN_PROGRESS: "In Progress",
      RESOLVED: "Resolved",
      OPEN: "Re-opened",
    };
    const portalUrl = `${appUrl}/apartment/${existing.apartmentId}/maintenance`;
    await sendEmail(
      existing.submittedBy.email,
      `Maintenance update — ${existing.title}`,
      notificationEmail(
        `Request ${STATUS_LABEL[parsed.data.status] ?? parsed.data.status}`,
        `Your maintenance request "${existing.title}" has been updated to ${STATUS_LABEL[parsed.data.status] ?? parsed.data.status}.${parsed.data.landlordNote ? ` Note: ${parsed.data.landlordNote}` : ""}`,
        portalUrl,
        "View request"
      )
    );
  }

  return NextResponse.json(updated);
}
