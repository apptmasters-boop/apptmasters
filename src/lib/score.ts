import { prisma } from "@/lib/db";

export async function adjustScore(
  userId: string,
  apartmentId: string,
  delta: number,
  reason: string,
) {
  const score = await prisma.roommateScore.upsert({
    where: { userId_apartmentId: { userId, apartmentId } },
    create: { userId, apartmentId, score: Math.min(100, Math.max(0, 50 + delta)) },
    update: { score: { increment: delta } },
  });

  // Clamp between 0 and 100
  if (score.score < 0 || score.score > 100) {
    await prisma.roommateScore.update({
      where: { id: score.id },
      data: { score: Math.min(100, Math.max(0, score.score)) },
    });
  }

  await prisma.scoreLog.create({ data: { scoreId: score.id, delta, reason } });
}
