import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, inviteEmail, appUrl } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;
  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
    include: { user: { select: { name: true } }, apartment: { select: { name: true, inviteCode: true } } },
  });

  if (!member || member.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const inviteUrl = `${appUrl}/apartment/join?code=${member.apartment.inviteCode}`;
  await sendEmail(
    parsed.data.email,
    `You're invited to join ${member.apartment.name} on ApptMasters`,
    inviteEmail(member.user.name, member.apartment.name, inviteUrl)
  );

  return NextResponse.json({ success: true });
}
