import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INTENTS } from "@/lib/intent";

/**
 * "What brings you to ApptMasters?" (step O1, owner 2026-10-18), answered once on
 * /welcome right after the email is confirmed. "I already have a place" also counts
 * as "I found a place" (foundHomeAt): the 11a rules then lead to Create a Home and
 * never ask "Have you found your new home?" (src/lib/housing.ts).
 */
const schema = z.object({ intent: z.enum(INTENTS, { error: "Choose what brings you to ApptMasters" }) });

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { intent } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { intent: true, foundHomeAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.intent) return NextResponse.json({ error: "Already answered", intent: user.intent }, { status: 409 });

  await prisma.user.update({
    where: { id: payload.userId },
    data: { intent, ...(intent === "HAVE_HOME" && !user.foundHomeAt ? { foundHomeAt: new Date() } : {}) },
  });
  return NextResponse.json({ intent });
}
