/**
 * Who counts as away (docs/PRODUCT_LOGIC.md §4, §8, §13.1): members travelling
 * (TravelPeriod), and members who haven't moved in yet (ApartmentMember.
 * moveInDate in the future, Sprint 11b, owner's decision 2026-10-16: "like
 * being away"). Cleaning and shopping turns skip them, and default expense
 * splits leave them out. Rent has its own rule (movedInBy, used by
 * src/lib/rent.ts): a month counts someone who has moved in by its due day.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { TravelSpan } from "@/lib/rotation";

/** The parts of the database client this needs (the client itself, or a transaction). */
type Db = { travelPeriod: typeof prisma.travelPeriod; apartmentMember: typeof prisma.apartmentMember };

/** Until their move-in day they count like someone away; from that day on, they're home. */
export function notMovedInSpan(userId: string, moveInDate: Date): TravelSpan {
  return { userId, startDate: new Date(0), endDate: new Date(moveInDate.getTime() - 1), returnedAt: null };
}

/** A move-in day from a date field (YYYY-MM-DD), stored at UTC midnight like the app's other days. */
export const moveInDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
  .refine(s => !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)), "Choose a valid date");
export const moveInDay = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

/** Has this member moved in by `date`? (No move-in date: living there already.) */
export const movedInBy = (moveInDate: Date | null, date: Date) => !moveInDate || moveInDate <= date;

/**
 * Trips not over yet (current and future) and members not moved in yet, as
 * spans for isAwayOn / upcomingTurns in src/lib/rotation.ts.
 */
export async function awaySpans(apartmentId: string, now = new Date(), db: Db = prisma): Promise<TravelSpan[]> {
  const [travels, arriving] = await Promise.all([
    db.travelPeriod.findMany({
      where: { apartmentId, returnedAt: null, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      select: { userId: true, startDate: true, endDate: true, returnedAt: true },
    }),
    db.apartmentMember.findMany({
      where: { apartmentId, status: { not: "MOVED_OUT" }, moveInDate: { gt: now } },
      select: { userId: true, moveInDate: true },
    }),
  ]);
  return [...travels, ...arriving.map(m => notMovedInSpan(m.userId, m.moveInDate!))];
}
