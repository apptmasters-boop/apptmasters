/**
 * User states and where each user lands after signing in
 * (docs/PRODUCT_LOGIC.md §2). Pure functions, shared by the server
 * (/api/auth/me) and the browser (post-login redirect).
 *
 *   VISITOR → HOME_SEEKER → FOUND_A_HOME → HOME_MEMBER
 *
 * VISITOR means "not signed in", so it never appears here. FOUND_A_HOME is
 * self-reported (User.foundHomeAt, set by the Sprint 11 follow-up prompt).
 * Role and context are separate: a platform admin or property manager who also
 * lives in a home is a HOME_MEMBER first and lands on Home like everyone else.
 */
export type HousingState = "HOME_SEEKER" | "FOUND_A_HOME" | "HOME_MEMBER";

export interface MeForLanding {
  systemRole: string;
  foundHomeAt?: string | Date | null;
  /** The sign-up answer (step O1); empty for older accounts. */
  intent?: string | null;
  memberships: { status: string; apartment: { id: string } }[];
}

/** Memberships that give access to a home (not waiting for approval, not moved out). */
export const activeMemberships = (me: MeForLanding) =>
  me.memberships.filter(m => m.status === "ACTIVE" || m.status === "VACATION");

export function housingState(me: MeForLanding): HousingState {
  if (activeMemberships(me).length > 0) return "HOME_MEMBER";
  if (me.foundHomeAt) return "FOUND_A_HOME";
  return "HOME_SEEKER";
}

/** Where to send a user right after they sign in. */
export function landingPath(me: MeForLanding): string {
  const homes = activeMemberships(me);
  if (homes.length > 0) return `/apartment/${homes[0].apartment.id}`;
  // Waiting for a household admin to approve a join request: Join status shows where it stands (Sprint 11b).
  if (me.memberships.some(m => m.status === "PENDING_APPROVAL")) return "/apartment/join/status";
  // Said "I found a place" (Sprint 11a): set up the home next. 11b turns this into the Home Setup flow.
  if (me.foundHomeAt) return "/apartment/create";
  if (me.systemRole === "MANAGER") return "/manager";
  if (me.systemRole === "SUPER_ADMIN") return "/admin";
  // Looking for a home: Home, with search, saved listings and Create / Join a Home (Sprint 12).
  return "/";
}

/**
 * "What brings you to ApptMasters?" not answered yet (step O1): asked on /welcome after
 * confirming the email, and again at sign-in if they left it. Only people still
 * looking: in a Home, waiting to join one, "I found a place", landlords and admins
 * are never asked.
 */
export function needsIntent(me: MeForLanding): boolean {
  return !me.intent && me.systemRole === "USER" && !me.foundHomeAt && me.memberships.length === 0;
}

/**
 * Where to go right after signing in. Same as landingPath, except that people who
 * signed up to rent a place out start on their listings (step O1, 2026-10-18). Home
 * itself stays open to them: it redirects by landingPath, not by this.
 * ("I already have a place" sets foundHomeAt, so landingPath already handles it.)
 */
export function signInPath(me: MeForLanding): string {
  if (needsIntent(me)) return "/welcome";
  const path = landingPath(me);
  return path === "/" && me.intent === "RENT_OUT" ? "/listings/mine" : path;
}

// ---------------------------------------------------------------------------
// "Have you found your new home?" (PRODUCT_LOGIC §3.3; owner's timing,
// 2026-10-16): 14 days after signing up, or 7 days after first messaging a
// listing owner, whichever comes first; after "I'm still looking", again 14
// days later. Signals help decide when to ask; they never prove a tenancy (§3.2).

const DAY = 86_400_000;
export const ASK_AFTER_SIGNUP_DAYS = 14;
export const ASK_AFTER_CONTACT_DAYS = 7;
export const ASK_AGAIN_AFTER_DAYS = 14;
/** The daily job runs at about the same time each day; this keeps "14 days later" from slipping a day. */
const JOB_SLACK_MS = 60 * 60_000;

export interface HomeSearchFacts {
  createdAt: Date;
  foundHomeAt: Date | null;
  stillLookingAt: Date | null;
  /** Lives in a home, or is waiting to be approved into one. */
  hasHome: boolean;
  /** When they last moved out of a home, if ever: a new search starts then. */
  leftHomeAt: Date | null;
  /** Their first message to a listing owner since the search started (searchStartedAt). */
  firstContactAt: Date | null;
  /** Has posted a listing: offering a place rather than looking, unless they also message an owner. */
  postsListings: boolean;
}

/** When the current search started: signing up, or moving out of their last home. */
export function searchStartedAt(createdAt: Date, leftHomeAt: Date | null): Date {
  return leftHomeAt && leftHomeAt > createdAt ? leftHomeAt : createdAt;
}

/** "I found a place" holds until they next move out of a home; then they're looking again. */
export function foundHomeHolds(foundHomeAt: Date | null, leftHomeAt: Date | null): boolean {
  return !!foundHomeAt && !(leftHomeAt && leftHomeAt > foundHomeAt);
}

/** When the question is due, or null when it doesn't apply (they have a home, found one, or only offer one). */
export function homeQuestionDueAt(f: HomeSearchFacts): Date | null {
  if (f.hasHome || foundHomeHolds(f.foundHomeAt, f.leftHomeAt)) return null;
  if (f.postsListings && !f.firstContactAt) return null;
  const start = searchStartedAt(f.createdAt, f.leftHomeAt);
  let due = start.getTime() + ASK_AFTER_SIGNUP_DAYS * DAY;
  if (f.firstContactAt && f.firstContactAt >= start) due = Math.min(due, f.firstContactAt.getTime() + ASK_AFTER_CONTACT_DAYS * DAY);
  if (f.stillLookingAt) due = Math.max(due, f.stillLookingAt.getTime() + ASK_AGAIN_AFTER_DAYS * DAY);
  return new Date(due);
}

/** Does the daily job ask today (email and push)? Never more than once in 14 days. */
export function homeQuestionEmailDue(f: HomeSearchFacts & { homeAskedAt: Date | null }, now: Date): boolean {
  const due = homeQuestionDueAt(f);
  if (!due || now < due) return false;
  return !f.homeAskedAt || now.getTime() - f.homeAskedAt.getTime() >= ASK_AGAIN_AFTER_DAYS * DAY - JOB_SLACK_MS;
}
