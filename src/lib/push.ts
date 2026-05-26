import webpush from "web-push";
import { prisma } from "@/lib/db";

const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const isPushConfigured = Boolean(vapidSubject && vapidPublicKey && vapidPrivateKey);

if (isPushConfigured) {
  webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);
} else {
  console.warn("Web push is not configured. Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY to enable push notifications.");
}

export async function sendPushToUser(userId: string, title: string, body: string, link?: string) {
  if (!isPushConfigured) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title, body, link: link ?? "/" });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async err => {
        // 410 Gone = subscription expired; remove it
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }),
    ),
  );
}

export async function sendPushToUsers(userIds: string[], title: string, body: string, link?: string) {
  await Promise.allSettled(userIds.map(id => sendPushToUser(id, title, body, link)));
}
