/**
 * The signed-out Home search (fix F7, owner's choice 2026-10-17): one Location
 * box and All · Rooms · Whole places; People, price and the rest are on the
 * results' top row (src/app/listings/page.tsx).
 */
export type HomeKind = "" | "room" | "whole";

export const HOME_KINDS: { value: HomeKind; label: string }[] = [
  { value: "", label: "All" },
  { value: "room", label: "Rooms" },
  { value: "whole", label: "Whole places" },
];

export interface ListingSearch {
  city: string;
  kind: HomeKind;
}

/**
 * The results address for a Home search: Rooms opens the Rooms tab
 * (kind=room); Whole places means apartments and houses (type=APARTMENT_FOR_RENT).
 */
export function searchToQuery(s: ListingSearch): string {
  const params = new URLSearchParams();
  if (s.city.trim()) params.set("q", s.city.trim());
  if (s.kind === "room") params.set("kind", "room");
  if (s.kind === "whole") params.set("type", "APARTMENT_FOR_RENT");
  return params.toString();
}
