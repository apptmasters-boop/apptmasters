// Central color mapping for feature icon badges — keeps chores/finance/etc.
// visually consistent wherever they appear (dashboard, sidebar, list rows).
export type CategoryColor =
  | "orange" | "cyan" | "green" | "purple" | "blue" | "rose" | "teal"
  | "sky" | "violet" | "emerald" | "amber" | "red" | "indigo" | "slate" | "gray";

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  chores: "orange",
  cleaning: "cyan",
  rotation: "orange",
  grocery: "green",
  inventory: "purple",
  finance: "blue",
  rent: "rose",
  fund: "teal",
  calendar: "sky",
  rooms: "violet",
  chat: "emerald",
  maintenance: "amber",
  disputes: "red",
  feed: "indigo",
  stats: "teal",
  agreements: "indigo",
  travel: "sky",
  listings: "blue",
  profile: "indigo",
  admin: "slate",
  moneyOwed: "red",
  cashConfirm: "amber",
  editApproval: "indigo",
  announcement: "amber",
};

const BADGE_CLASSES: Record<CategoryColor, string> = {
  orange: "bg-orange-100 text-orange-600",
  cyan: "bg-cyan-100 text-cyan-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  blue: "bg-blue-100 text-blue-600",
  rose: "bg-rose-100 text-rose-600",
  teal: "bg-teal-100 text-teal-600",
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  indigo: "bg-indigo-100 text-indigo-600",
  slate: "bg-slate-100 text-slate-600",
  gray: "bg-gray-100 text-gray-500",
};

export function badgeClasses(color: CategoryColor): string {
  return BADGE_CLASSES[color];
}
