/**
 * "What brings you to ApptMasters?" (step O1, owner 2026-10-18): one required
 * question on the sign-up form, pre-selected from what the person was doing.
 * Pure functions, shared by the form, the sign-up API and the landing rules.
 *
 *   FIND_HOME   I'm looking for a place      → Home (search, Saved)
 *   HAVE_HOME   I already have a place       → Create a Home (it links "Join their home")
 *   RENT_OUT    I have a place to rent out   → Post a listing; later, My listings
 */
export const INTENTS = ["FIND_HOME", "HAVE_HOME", "RENT_OUT"] as const;
export type Intent = (typeof INTENTS)[number];

export const isIntent = (v: unknown): v is Intent => typeof v === "string" && (INTENTS as readonly string[]).includes(v);

/** Short labels, for Admin → Users. */
export const INTENT_LABELS: Record<Intent, string> = { FIND_HOME: "Looking for a place", HAVE_HOME: "Already has a place", RENT_OUT: "Has a place to rent out" };

/** Where someone starts after confirming their email, when nothing else was in progress. */
export const INTENT_START: Record<Intent, string> = {
  FIND_HOME: "/",
  HAVE_HOME: "/apartment/create",
  RENT_OUT: "/listings/new",
};

/** The answer that fits the page they signed up from, or null when they should choose. */
export function intentFromReturnTo(returnTo: string | null | undefined): Intent | null {
  if (!returnTo) return null;
  const [path, query = ""] = returnTo.split("?");
  if (/(^|&)save=/.test(query)) return "FIND_HOME"; // saving a listing (saveSignInPath)
  if (path === "/listings/new" || path === "/listings/mine") return "RENT_OUT";
  if (path.startsWith("/apartment/create") || path.startsWith("/apartment/join")) return "HAVE_HOME";
  if (path === "/listings" || path.startsWith("/listings/") || path === "/saved") return "FIND_HOME";
  return null;
}

/**
 * Where to go after confirming: back to what they were doing when it fits their
 * answer (the listing they saved, the message they started); otherwise the
 * answer's start page.
 */
export function afterSignup(intent: Intent, returnTo: string | null | undefined): string {
  return returnTo && intentFromReturnTo(returnTo) === intent ? returnTo : INTENT_START[intent];
}
