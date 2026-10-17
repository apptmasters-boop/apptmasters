/**
 * The signed-out Home search (owner's choices 2026-10-17, fixes F7 and F10):
 * one Location box. Every filter, the kind of place included, is on the
 * results page (src/app/listings/page.tsx): its tabs, top row and Filters.
 */
export interface ListingSearch {
  city: string;
}

/** The results address for a Home search. */
export function searchToQuery(s: ListingSearch): string {
  const params = new URLSearchParams();
  if (s.city.trim()) params.set("q", s.city.trim());
  return params.toString();
}
