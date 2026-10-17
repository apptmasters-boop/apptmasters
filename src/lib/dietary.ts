/** Dietary needs a person can mark on their profile (shown to their household, used by Shopping). */
export const DIETARY_OPTIONS: { key: string; label: string }[] = [
  { key: "VEGAN", label: "🌱 Vegan" },
  { key: "VEGETARIAN", label: "🥦 Vegetarian" },
  { key: "GLUTEN_FREE", label: "🌾 Gluten-free" },
  { key: "DAIRY_FREE", label: "🥛 Dairy-free" },
  { key: "NUT_FREE", label: "🥜 Nut-free" },
  { key: "HALAL", label: "☪️ Halal" },
  { key: "KOSHER", label: "✡️ Kosher" },
];

/** The stored JSON list, read safely. */
export function parseDietary(stored: string | null | undefined): string[] {
  try {
    const list = JSON.parse(stored || "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const dietaryLabel = (key: string) => DIETARY_OPTIONS.find(o => o.key === key)?.label ?? key;
