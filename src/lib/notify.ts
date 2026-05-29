import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

interface NotifyParams {
  apartmentId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string;
  sendEmailTo?: string[]; // subset of userIds to also email
}

export async function notify({ apartmentId, userIds, type, title, body, link, sendEmailTo }: NotifyParams) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map(userId => ({ apartmentId, userId, type, title, body, link: link ?? null })),
  });
  // Respect per-user notification preferences
  const userPrefs = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, notifPrefs: true },
  });

  const pushIds = userPrefs
    .filter(u => { const p = JSON.parse(u.notifPrefs || "{}"); return p.pushEnabled !== false; })
    .map(u => u.id);

  const emailIds = (sendEmailTo ?? []).filter(id => {
    const u = userPrefs.find(u => u.id === id);
    const p = JSON.parse(u?.notifPrefs || "{}");
    return p.emailEnabled !== false;
  });

  // Fire-and-forget push and email — don't block the API response
  if (pushIds.length > 0) sendPushToUsers(pushIds, title, body, link).catch(() => {});
  if (emailIds.length > 0) {
    const emailUsers = userPrefs.filter(u => emailIds.includes(u.id));
    const actionUrl = link ? `${appUrl}${link}` : undefined;
    emailUsers.forEach(u => {
      sendEmail(u.email, title, notificationEmail(title, body, actionUrl, "View")).catch(() => {});
    });
  }
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
