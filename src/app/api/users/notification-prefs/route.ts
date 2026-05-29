import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  types: z.record(z.string(), z.boolean()).optional(),
});

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { notifPrefs: true },
  });

  const prefs = JSON.parse(user?.notifPrefs ?? "{}");
  return NextResponse.json({
    pushEnabled: prefs.pushEnabled ?? true,
    emailEnabled: prefs.emailEnabled ?? true,
    types: prefs.types ?? {},
  });
}

export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { notifPrefs: true },
  });

  const current = JSON.parse(user?.notifPrefs ?? "{}");
  const updated = {
    pushEnabled: parsed.data.pushEnabled ?? current.pushEnabled ?? true,
    emailEnabled: parsed.data.emailEnabled ?? current.emailEnabled ?? true,
    types: { ...(current.types ?? {}), ...(parsed.data.types ?? {}) },
  };

  await prisma.user.update({
    where: { id: payload.userId },
    data: { notifPrefs: JSON.stringify(updated) },
  });

  return NextResponse.json(updated);
}
