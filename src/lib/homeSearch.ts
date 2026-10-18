/**
 * "Have you found your new home?" (Sprint 11a, PRODUCT_LOGIC §3.3). The timing
 * rules are pure, in src/lib/housing.ts; this file gathers each person's facts,
 * records their answer, and runs the daily job that asks by email and push (a
 * person without a home has no in-app bell, so the Listings card is the in-app
 * question).
 */
import { prisma } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";
import { channelsFor } from "@/lib/notificationTypes";
import { homeQuestionDueAt, homeQuestionEmailDue, searchStartedAt, type HomeSearchFacts } from "@/lib/housing";

/** For the person's settings this counts as Household (push and email are chosen per category). */
export const HOME_QUESTION_TYPE = "HOME_QUESTION";
const TITLE = "Have you found your new home?";
const EMAIL_BODY = "If you've found a place, tell us and set up your home with your roommates: rent, cleaning and shopping, shared. Still looking? Say so and we'll check back in two weeks. (You can turn these emails off in your profile, under Household.)";
const PUSH_BODY = "Tell us if you've found a place, or that you're still looking.";

const EMAIL_PAUSE_MS = 600;

/** Where "Yes, I found a place" leads until Home Setup (11b) exists. */
export const AFTER_FOUND_PATH = "/apartment/create";

const personSelect = {
  id: true, email: true, systemRole: true, notifPrefs: true,
  createdAt: true, foundHomeAt: true, stillLookingAt: true, homeAskedAt: true, intent: true,
  memberships: { select: { status: true, movedOutAt: true } },
  _count: { select: { listings: true } },
} as const;
type Person = NonNullable<Awaited<ReturnType<typeof findPerson>>>;
const findPerson = (id: string) => prisma.user.findUnique({ where: { id }, select: personSelect });

async function factsFor(p: Person): Promise<HomeSearchFacts> {
  const hasHome = p.memberships.some(m => m.status !== "MOVED_OUT");
  const leftHomeAt = p.memberships.reduce<Date | null>(
    (last, m) => m.status === "MOVED_OUT" && m.movedOutAt && (!last || m.movedOutAt > last) ? m.movedOutAt : last, null);
  // First message to someone else's listing in this search (replies to people writing about your own listing don't count).
  const first = hasHome ? null : await prisma.listingMessage.findFirst({
    where: { senderId: p.id, createdAt: { gte: searchStartedAt(p.createdAt, leftHomeAt) }, listing: { ownerId: { not: p.id } } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return {
    createdAt: p.createdAt, foundHomeAt: p.foundHomeAt, stillLookingAt: p.stillLookingAt,
    hasHome, leftHomeAt, firstContactAt: first?.createdAt ?? null,
    // Signed up to rent a place out (step O1) counts like having posted: offering, not looking.
    postsListings: p._count.listings > 0 || p.intent === "RENT_OUT",
  };
}

/** Should the Listings card ask this person now? Only people looking for a home (not managers or admins). */
export async function homeQuestionFor(userId: string, now = new Date()) {
  const p = await findPerson(userId);
  if (!p || p.systemRole !== "USER") return { ask: false };
  const due = homeQuestionDueAt(await factsFor(p));
  return { ask: !!due && now >= due };
}

export type HomeAnswer = "LOOKING" | "FOUND";

/** "I'm still looking" (asked again in 14 days) or "Yes, I found a place" (FOUND_A_HOME, then Home Setup). */
export async function answerHomeQuestion(userId: string, answer: HomeAnswer, now = new Date()) {
  const p = await findPerson(userId);
  if (!p) return { error: "Not found", status: 404 } as const;
  if ((await factsFor(p)).hasHome) return { error: "You already have a home on ApptMasters", status: 409 } as const;
  await prisma.user.update({
    where: { id: userId },
    // "Still looking" also takes back an earlier "I found a place".
    data: answer === "FOUND" ? { foundHomeAt: now } : { stillLookingAt: now, foundHomeAt: null },
  });
  return { next: answer === "FOUND" ? AFTER_FOUND_PATH : null } as const;
}

/**
 * The daily job (server crontab): asks each person whose question is due, by
 * email and push as their settings allow, never more than once in 14 days.
 * `onlyUsers` limits it to some people (tests); `dryRun` only counts.
 */
export async function runHomeQuestion(now: Date, opts: { onlyUsers?: string[]; dryRun?: boolean } = {}) {
  const candidates = await prisma.user.findMany({
    where: {
      ...(opts.onlyUsers ? { id: { in: opts.onlyUsers } } : {}),
      systemRole: "USER",
      emailVerified: true,
      memberships: { none: { status: { not: "MOVED_OUT" } } },
      // A first cut only (asked in the last 13 days: certainly not again yet); homeQuestionEmailDue decides.
      OR: [{ homeAskedAt: null }, { homeAskedAt: { lte: new Date(now.getTime() - 13 * 86_400_000) } }],
    },
    select: personSelect,
  });
  let asked = 0, emailed = 0, lastEmailAt = 0;
  for (const p of candidates) {
    if (!homeQuestionEmailDue({ ...(await factsFor(p)), homeAskedAt: p.homeAskedAt }, now)) continue;
    asked++;
    if (opts.dryRun) continue;
    const allowed = channelsFor(p.notifPrefs, HOME_QUESTION_TYPE);
    if (allowed.push) sendPushToUsers([p.id], TITLE, PUSH_BODY, "/").catch(() => {});
    let sent = false;
    if (allowed.email) {
      // One at a time, with a pause: Resend takes about 2 emails a second.
      const wait = lastEmailAt + EMAIL_PAUSE_MS - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastEmailAt = Date.now();
      sent = await sendEmail(p.email, TITLE, notificationEmail(TITLE, EMAIL_BODY, `${appUrl}/?ask=home`, "Answer")).catch(() => false);
      if (sent) emailed++;
    }
    // When email was the only way to reach them and it failed, tomorrow's run tries again.
    if (sent || allowed.push || !allowed.email) await prisma.user.update({ where: { id: p.id }, data: { homeAskedAt: now } });
  }
  return { asked, emailed };
}
