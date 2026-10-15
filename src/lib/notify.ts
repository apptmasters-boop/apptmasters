/**
 * The one notification service (docs/PRODUCT_LOGIC.md §20). Every notification
 * goes through `notify`:
 *
 *   in-app   always (the bell and Home are the record)
 *   push     if the person allows push for this category (and push at all)
 *   email    only when the caller asks for it (`sendEmailTo`), and the person
 *            allows email for this category (and email at all)
 *
 * Anti-spam: after a notification in a category, more in the same category
 * within QUIET_MS only appear in the app, unless marked `important`.
 * Categories and preferences: src/lib/notificationTypes.ts.
 */
import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { categoryOf, channelsFor } from "@/lib/notificationTypes";

/** Quiet period for push and email within one category, per person. */
export const QUIET_MS = 2 * 60_000;

interface NotifyParams {
  apartmentId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string;
  sendEmailTo?: string[]; // subset of userIds to also email
  /** When it happened, for scheduled jobs that work out "today" themselves (default: now). */
  at?: Date;
  /** Always push/email (still within the person's settings), even in a quiet period. */
  important?: boolean;
}

export async function notify({ apartmentId, userIds, type, title, body, link, sendEmailTo, at, important }: NotifyParams) {
  if (userIds.length === 0) return;
  const now = at ?? new Date();
  const category = categoryOf(type);

  // Who already heard from this category in the last few minutes (looked up before adding this one).
  const recent = important ? [] : await prisma.notification.findMany({
    where: { userId: { in: userIds }, createdAt: { gte: new Date(now.getTime() - QUIET_MS), lte: now } },
    select: { userId: true, type: true },
  });
  const quiet = new Set(recent.filter(n => categoryOf(n.type) === category).map(n => n.userId));

  await prisma.notification.createMany({
    data: userIds.map(userId => ({ apartmentId, userId, type, title, body, link: link ?? null, ...(at ? { createdAt: at } : {}) })),
  });

  const people = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, notifPrefs: true } });
  const allowed = new Map(people.map(p => [p.id, channelsFor(p.notifPrefs, type)]));
  const pushIds = people.filter(p => allowed.get(p.id)!.push && !quiet.has(p.id)).map(p => p.id);
  const emailTo = people.filter(p => sendEmailTo?.includes(p.id) && allowed.get(p.id)!.email && !quiet.has(p.id));

  // Push and email don't hold up the request.
  if (pushIds.length > 0) sendPushToUsers(pushIds, title, body, link).catch(() => {});
  const actionUrl = link ? `${appUrl}${link}` : undefined;
  for (const p of emailTo) sendEmail(p.email, title, notificationEmail(title, body, actionUrl, "View")).catch(() => {});
}

export async function notifyApartment(
  apartmentId: string,
  excludeUserId: string | null,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: { not: "MOVED_OUT" } },
    select: { userId: true },
  });
  const userIds = members.map(m => m.userId).filter(id => id !== excludeUserId);
  await notify({ apartmentId, userIds, type, title, body, link });
}

/**
 * Sends a phone/browser push to one person for an existing notification that
 * was updated rather than created (the shopper's grouped alert), if their
 * settings allow push for that type.
 */
export async function pushIfEnabled(userId: string, type: string, title: string, body: string, link?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifPrefs: true } });
  if (!user || !channelsFor(user.notifPrefs, type).push) return;
  sendPushToUsers([userId], title, body, link).catch(() => {});
}
