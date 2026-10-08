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
  // Waiting for a household admin to approve a join request: "Your homes" shows it as pending.
  if (me.memberships.some(m => m.status === "PENDING_APPROVAL")) return "/dashboard";
  if (me.systemRole === "MANAGER") return "/manager";
  if (me.systemRole === "SUPER_ADMIN") return "/admin";
  return "/listings";
}
