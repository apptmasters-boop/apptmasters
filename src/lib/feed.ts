import { prisma } from "@/lib/db";

interface FeedParams {
  apartmentId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function createFeedItem({ apartmentId, userId, type, title, body, link }: FeedParams) {
  return prisma.feedItem.create({
    data: { apartmentId, userId, type, title, body, link: link ?? null },
  });
}
