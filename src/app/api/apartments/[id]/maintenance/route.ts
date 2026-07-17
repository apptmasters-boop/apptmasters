import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

const schema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "URGENT"]).default("MEDIUM"),
  photo: z.string().url().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requests = await prisma.maintenanceRequest.findMany({
    where: { apartmentId },
    include: { submittedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: apartmentId } = await params;
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
    include: { apartment: { include: { manager: { select: { email: true, name: true } } } } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const unit = await prisma.unit.findFirst({ where: { apartmentId } });

  const request = await prisma.maintenanceRequest.create({
    data: {
      ...parsed.data,
      apartmentId,
      unitId: unit?.id ?? null,
      submittedById: payload.userId,
    },
    include: { submittedBy: { select: { name: true } } },
  });

  const manager = member.apartment.manager;
  if (manager?.email) {
    const portalUrl = `${appUrl}/manager`;
    await sendEmail(
      manager.email,
      `New maintenance request — ${parsed.data.title}`,
      notificationEmail(
        `New Maintenance Request (${parsed.data.priority})`,
        `${request.submittedBy.name} submitted a request: "${parsed.data.title}". ${parsed.data.description}`,
        portalUrl,
        "View in manager portal"
      )
    );
  }

  return NextResponse.json(request, { status: 201 });
}
