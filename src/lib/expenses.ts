/**
 * Shared-expense split rules, used by Add Expense and by finishing a shopping
 * trip (docs/PRODUCT_LOGIC.md §10.8, §13.1), so both split money the same way.
 */
import { prisma } from "@/lib/db";

/** Everyone who shares household costs: active members, not guests. */
export async function splitMembers(apartmentId: string) {
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: "ACTIVE", role: { not: "GUEST" } },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, name: true } } },
  });
  return members.map(m => m.user);
}

/** Ids of members travelling right now. The payer is never counted as away. */
export async function awayNow(apartmentId: string, payerId: string, now = new Date()) {
  const travels = await prisma.travelPeriod.findMany({
    where: { apartmentId, startDate: { lte: now }, returnedAt: null, OR: [{ endDate: null }, { endDate: { gte: now } }], userId: { not: payerId } },
    select: { userId: true },
  });
  return new Set(travels.map(t => t.userId));
}

/** Who an equal split includes by default: everyone who shares costs, minus people away. */
export async function defaultSplit(apartmentId: string, payerId: string, now = new Date()) {
  const [members, away] = await Promise.all([splitMembers(apartmentId), awayNow(apartmentId, payerId, now)]);
  return members.map(m => m.id).filter(id => !away.has(id));
}

/**
 * Equal shares of `amount` between `memberIds`, rounded to the cent. The payer's
 * own share is stored as 0: they paid it already, and it is never owed.
 */
export function equalSplits(amount: number, memberIds: string[], payerId: string) {
  if (memberIds.length === 0) return [];
  const share = parseFloat((amount / memberIds.length).toFixed(2));
  return memberIds.map(userId => ({ userId, amount: userId === payerId ? 0 : share }));
}
