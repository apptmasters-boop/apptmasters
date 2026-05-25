import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";

interface NotifyParams {
  apartmentId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function notify({ apartmentId, userIds, type, title, body, link }: NotifyParams) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map(userId => ({ apartmentId, userId, type, title, body, link: link ?? null })),
  });
  // Fire-and-forget push — don't block the API response
  sendPushToUsers(userIds, title, body, link).catch(() => {});
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
