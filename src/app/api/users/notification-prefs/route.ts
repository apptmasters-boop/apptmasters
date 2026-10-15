import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NOTIFICATION_CATEGORIES, readPrefs } from "@/lib/notificationTypes";

const categoryKeys = NOTIFICATION_CATEGORIES.map(c => c.key) as [string, ...string[]];
const schema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  // Per category (Sprint 9b): { RENT: { push: false }, … }, only the ones that change. In-app is always on.
  categories: z.partialRecord(z.enum(categoryKeys), z.object({ push: z.boolean().optional(), email: z.boolean().optional() })).optional(),
});

/** The person's notification settings, with every category filled in (defaults: on). */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { notifPrefs: true } });
  return NextResponse.json({ ...readPrefs(user?.notifPrefs), categoryList: NOTIFICATION_CATEGORIES });
}

/** Change some settings; anything not sent stays as it was. */
export async function PATCH(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { notifPrefs: true } });
  const current = readPrefs(user?.notifPrefs);
  const categories = { ...current.categories };
  for (const [key, change] of Object.entries(parsed.data.categories ?? {})) {
    const k = key as keyof typeof categories;
    categories[k] = { ...categories[k], ...change };
  }
  const updated = {
    pushEnabled: parsed.data.pushEnabled ?? current.pushEnabled,
    emailEnabled: parsed.data.emailEnabled ?? current.emailEnabled,
    categories,
  };

  await prisma.user.update({ where: { id: payload.userId }, data: { notifPrefs: JSON.stringify(updated) } });
  return NextResponse.json(updated);
}
