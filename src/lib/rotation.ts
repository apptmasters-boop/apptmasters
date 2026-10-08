/**
 * Rotation rules shared by the cleaning API routes and the Schedule view
 * (docs/PRODUCT_LOGIC.md §8): whose turn is next, when it's due, and who is away.
 */

export function nextDueDate(frequency: string, from: Date = new Date()): Date {
  const d = new Date(from);
  if (frequency === "DAILY") d.setDate(d.getDate() + 1);
  else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1); // MONTHLY
  return d;
}

// Next occurrence of the given weekday (0=Sunday..6=Saturday), always at least 1 day after `from`.
export function nextWeekdayDate(weekday: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}

export interface TravelSpan { userId: string; startDate: Date; endDate: Date | null; returnedAt: Date | null }

/** Is `userId` away on `date` according to their travel periods (not yet marked back home)? */
export function isAwayOn(travels: TravelSpan[], userId: string, date: Date): boolean {
  return travels.some(t =>
    t.userId === userId && !t.returnedAt && t.startDate <= date && (t.endDate === null || t.endDate >= date));
}

/**
 * The index of the next person after `currentIndex` who isn't away, wrapping
 * around the order. If everyone is away, it's simply the next person.
 */
export function nextMemberIndex(order: string[], currentIndex: number, isAway: (userId: string) => boolean): number {
  for (let i = 1; i <= order.length; i++) {
    const candidate = (currentIndex + i) % order.length;
    if (!isAway(order[candidate])) return candidate;
  }
  return (currentIndex + 1) % order.length;
}

export interface ScheduledTurn { userId: string; due: Date | null }

/**
 * The next `count` turns, starting with the current one. Each later turn uses
 * the same rules as marking a turn done: the next person who isn't away on
 * that turn's date, and the due date moved on by one period.
 */
export function upcomingTurns(rotation: { memberOrder: string[]; currentIndex: number; nextDue: Date | null; frequency: string },
  travels: TravelSpan[], count: number): ScheduledTurn[] {
  const order = rotation.memberOrder;
  if (order.length === 0) return [];
  let index = rotation.currentIndex % order.length;
  let due = rotation.nextDue;
  const turns: ScheduledTurn[] = [{ userId: order[index], due }];
  for (let k = 1; k < count; k++) {
    due = nextDueDate(rotation.frequency, due ?? new Date());
    const when = due;
    index = nextMemberIndex(order, index, uid => isAwayOn(travels, uid, when));
    turns.push({ userId: order[index], due });
  }
  return turns;
}
