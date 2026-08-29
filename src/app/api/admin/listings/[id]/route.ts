import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REMOVE"]),
  rejectionReason: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireSuperAdmin(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id }, include: { owner: { select: { name: true, email: true } } } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "REJECT" && !parsed.data.rejectionReason) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const status = parsed.data.action === "APPROVE" ? "APPROVED" : parsed.data.action === "REJECT" ? "REJECTED" : "REMOVED";

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedById: payload.userId,
      rejectionReason: parsed.data.action === "REJECT" ? parsed.data.rejectionReason : listing.rejectionReason,
    },
  });

  await logAudit({
    action: `LISTING_${parsed.data.action}D`,
    entityType: "listing",
    entityId: id,
    meta: { title: listing.title, ...(parsed.data.rejectionReason ? { rejectionReason: parsed.data.rejectionReason } : {}) },
    userId: payload.userId,
  });

  if (listing.owner.email) {
    const title =
      parsed.data.action === "APPROVE" ? "Your listing is live" :
      parsed.data.action === "REJECT" ? "Your listing needs changes" :
      "Your listing was removed";
    const body =
      parsed.data.action === "APPROVE" ? `"${listing.title}" has been approved and is now visible to everyone browsing listings.` :
      parsed.data.action === "REJECT" ? `"${listing.title}" wasn't approved: ${parsed.data.rejectionReason}. Edit and resubmit it any time.` :
      `"${listing.title}" was removed by an admin.`;
    sendEmail(
      listing.owner.email,
      title,
      notificationEmail(title, body, `${appUrl}/listings/mine`, "View my listings")
    ).catch(() => {});
  }

  return NextResponse.json(updated);
}
