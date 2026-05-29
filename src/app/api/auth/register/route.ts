import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`register:${ip}`, 5, 60_000); // 5 registrations per minute per IP
  if (!ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  const systemRole = superAdminEmail && email.toLowerCase() === superAdminEmail ? "SUPER_ADMIN" : "USER";
  const user = await prisma.user.create({
    data: { name, email, password: hashed, systemRole },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
}
