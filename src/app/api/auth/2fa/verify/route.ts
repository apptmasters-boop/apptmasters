import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { ok } = rateLimit(`2fa-verify:${ip}`, 10, 60_000);
  if (!ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

  const record = await prisma.twoFactorCode.findFirst({
    where: { userId: user.id, code, used: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });

  await prisma.twoFactorCode.update({ where: { id: record.id }, data: { used: true } });

  const token = signToken({ userId: user.id, email: user.email });
  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}
