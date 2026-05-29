import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { notifyApartment } from "@/lib/notify";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disputes = await prisma.dispute.findMany({
    where: { apartmentId },
    include: {
      raisedBy: { select: { id: true, name: true } },
      against: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(disputes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, againstId } = await req.json().catch(() => ({}));
  if (!title || !description) return NextResponse.json({ error: "title and description required" }, { status: 400 });

  const dispute = await prisma.dispute.create({
    data: { apartmentId, raisedById: payload.userId, title, description, againstId: againstId || null },
    include: {
      raisedBy: { select: { id: true, name: true } },
      against: { select: { id: true, name: true } },
    },
  });

  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: { not: "MOVED_OUT" } },
    select: { userId: true },
  });
  const notifyIds = members.map(m => m.userId).filter(id => id !== payload.userId);
  await notifyApartment(
    apartmentId, payload.userId, "DISPUTE_FILED",
    "New dispute raised",
    `${dispute.raisedBy.name} raised a dispute: "${title}"`,
    `/apartment/${apartmentId}/disputes`,
  );
  // Also email the person the dispute is against, if any
  if (dispute.against?.id && dispute.against.id !== payload.userId) {
    const { notify } = await import("@/lib/notify");
    notify({
      apartmentId, userIds: [], type: "DISPUTE_FILED",
      title: "A dispute was raised against you",
      body: `${dispute.raisedBy.name}: "${title}"`,
      link: `/apartment/${apartmentId}/disputes`,
      sendEmailTo: [dispute.against.id],
    }).catch(() => {});
  }

  return NextResponse.json(dispute, { status: 201 });
}
