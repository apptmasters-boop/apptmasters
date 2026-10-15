/**
 * Notification categories (docs/PRODUCT_LOGIC.md §20): every notification type
 * belongs to one, and people choose push and email per category. No database
 * access here, so the settings page can use it too. The sending rules are in
 * src/lib/notify.ts.
 */

export const NOTIFICATION_CATEGORIES = [
  { key: "RENT", label: "Rent", description: "Rent starting, due and late; the landlord payment" },
  { key: "MONEY", label: "Money", description: "Shared expenses, payments, the shared fund" },
  { key: "CLEANING", label: "Cleaning & chores", description: "Your turn, swaps, chores" },
  { key: "SHOPPING", label: "Shopping", description: "Your shopping turn, items added while you shop" },
  { key: "MAINTENANCE", label: "Maintenance", description: "Repair requests, visits, updates" },
  { key: "HOUSEHOLD", label: "Household", description: "Members, rules, events, announcements" },
  { key: "MESSAGES", label: "Messages", description: "Direct messages" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

/** Type prefixes, checked in order; anything else is Household. */
const BY_PREFIX: [string, NotificationCategory][] = [
  ["RENT_", "RENT"],
  ["EXPENSE_", "MONEY"], ["PAYMENT_", "MONEY"], ["CASH_PAYMENT_", "MONEY"], ["FUND_", "MONEY"], ["SETTLEMENT", "MONEY"],
  ["CLEANING_", "CLEANING"], ["CHORE", "CLEANING"], ["ROTATION_ADVANCE", "CLEANING"],
  ["SHOPPING_", "SHOPPING"], ["GROCERY_", "SHOPPING"], ["ROTATION_PURCHASED", "SHOPPING"], ["ITEM_", "SHOPPING"],
  ["MAINTENANCE_", "MAINTENANCE"],
  ["DIRECT_MESSAGE", "MESSAGES"],
];

export function categoryOf(type: string): NotificationCategory {
  return BY_PREFIX.find(([prefix]) => type.startsWith(prefix))?.[1] ?? "HOUSEHOLD";
}

export interface ChannelChoice { push: boolean; email: boolean }

/** Defaults keep the behavior from before Sprint 9b: everything on. */
export const DEFAULT_CHANNELS: ChannelChoice = { push: true, email: true };

/** The stored preferences (User.notifPrefs JSON), with defaults filled in. */
export function readPrefs(raw: string | null | undefined) {
  let stored: { pushEnabled?: boolean; emailEnabled?: boolean; categories?: Record<string, Partial<ChannelChoice>> } = {};
  try { stored = JSON.parse(raw || "{}"); } catch { /* treat unreadable settings as defaults */ }
  const categories = Object.fromEntries(NOTIFICATION_CATEGORIES.map(c => [c.key, { ...DEFAULT_CHANNELS, ...(stored.categories?.[c.key] ?? {}) }])) as Record<NotificationCategory, ChannelChoice>;
  return { pushEnabled: stored.pushEnabled !== false, emailEnabled: stored.emailEnabled !== false, categories };
}

/** May this person get a push / an email for this type? (In-app is always on.) */
export function channelsFor(rawPrefs: string | null | undefined, type: string): ChannelChoice {
  const prefs = readPrefs(rawPrefs);
  const choice = prefs.categories[categoryOf(type)];
  return { push: prefs.pushEnabled && choice.push, email: prefs.emailEnabled && choice.email };
}
