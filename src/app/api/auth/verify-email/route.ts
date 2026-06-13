import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  const jwt = signToken({ userId: user!.id, email: user!.email });
  return NextResponse.json({ token: jwt, user: { id: user!.id, name: user!.name, email: user!.email } });
}
