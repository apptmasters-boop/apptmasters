import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1, "Please enter your name").max(80, "Name is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await prisma.landlordInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Already used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });

  return NextResponse.json({ email: invite.email });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await prisma.landlordInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Already used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: invite.email,
      password: hash,
      emailVerified: true,
      systemRole: "MANAGER",
    },
  });

  await prisma.landlordInvite.update({ where: { token }, data: { acceptedAt: new Date() } });

  const jwtToken = signToken({ userId: user.id, email: user.email });
  return NextResponse.json(
    { token: jwtToken, user: { id: user.id, name: user.name, email: user.email } },
    { status: 201 }
  );
}
