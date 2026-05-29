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
  // Fire-and-forget push and email — don't block the API response
  sendPushToUsers(userIds, title, body, link).catch(() => {});
  if (sendEmailTo && sendEmailTo.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: sendEmailTo } },
      select: { email: true },
    });
    const actionUrl = link ? `${appUrl}${link}` : undefined;
    users.forEach(u => {
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
