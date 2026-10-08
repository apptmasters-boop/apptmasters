/**
 * Navigation model for "My Home" (docs/PRODUCT_LOGIC.md §5, §17).
 *
 * Five primary destinations, shown as the bottom bar on phones and the side
 * menu on computers: Home | Household | Money | Chat | More. Primary pages have
 * no back arrow; every other apartment page belongs to one of the five and
 * shows a back arrow to it.
 */
export type HomeTab = "home" | "household" | "money" | "chat" | "more";

export const HOME_TABS: { tab: HomeTab; label: string; path: string }[] = [
  { tab: "home", label: "Home", path: "" },
  { tab: "household", label: "Household", path: "household" },
  { tab: "money", label: "Money", path: "money" },
  { tab: "chat", label: "Chat", path: "chat" },
  { tab: "more", label: "More", path: "more" },
];

/** Which primary destination each apartment section belongs to. Anything not listed lives under More. */
const SECTION_TAB: Record<string, HomeTab> = {
  household: "household", cleaning: "household", grocery: "household", rotation: "household",
  inventory: "household", chores: "household", rooms: "household",
  money: "money", finance: "money", rent: "money", fund: "money",
  chat: "chat",
  members: "home", moveout: "home",
};

const tabInfo = (tab: HomeTab) => HOME_TABS.find(t => t.tab === tab)!;
export const tabHref = (apartmentId: string, tab: HomeTab) =>
  `/apartment/${apartmentId}${tabInfo(tab).path ? `/${tabInfo(tab).path}` : ""}`;

export interface HomeNavState {
  tab: HomeTab;
  isPrimary: boolean;
  /** Where the back arrow goes; null on primary pages. */
  back: { href: string; label: string } | null;
}

export function homeNavState(pathname: string, apartmentId: string): HomeNavState {
  const base = `/apartment/${apartmentId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).split("/").filter(Boolean) : [];
  if (rest.length === 0) return { tab: "home", isPrimary: true, back: null };

  const tab = SECTION_TAB[rest[0]] ?? "more";
  const isPrimary = rest.length === 1 && tabInfo(tab).path === rest[0];
  if (isPrimary) return { tab, isPrimary, back: null };

  // Section pages go back to their tab. Deeper pages (a room, a DM) have their
  // own back link to their section, so this is only used one level down.
  return { tab, isPrimary: false, back: { href: tabHref(apartmentId, tab), label: tabInfo(tab).label } };
}
