import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).optional().default("MEMBER"),
});

async function canManage(userId: string, apartmentId: string): Promise<boolean> {
  const apt = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
  if (!apt) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
  return apt.managerId === userId || user?.systemRole === "SUPER_ADMIN";
}

function randomPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireManager(req);
  if (!payload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: apartmentId } = await params;
  if (!(await canManage(payload.userId, apartmentId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, role } = parsed.data;
  let user = await prisma.user.findUnique({ where: { email } });
  let tempPassword: string | null = null;

  if (!user) {
    // Create account with a temporary password
    tempPassword = randomPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    user = await prisma.user.create({
      data: { name: email.split("@")[0], email, password: hashed },
    });
  }

  const existing = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: user.id, apartmentId } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const member = await prisma.apartmentMember.create({
    data: { userId: user.id, apartmentId, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ member, tempPassword }, { status: 201 });
}
