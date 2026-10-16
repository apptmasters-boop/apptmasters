/**
 * "Find a Home" search (Sprint 12; docs/MARKETPLACE_FLOW.md §3–§7, §12): the
 * filters, how they live in the page address (so they survive signing in and
 * the Back button), the removable chips, and the database query. No database
 * access, so the filter screens use it too.
 *
 * Results only show listings that match (§7). A listing that doesn't state a
 * detail doesn't match a filter on that detail; in particular a listing must
 * declare how many people can live there to match an occupants search (§5).
 * A listing with no "available from" date counts as available now.
 */
import type { Prisma } from "@/generated/prisma/client";
import { AMENITIES, PROPERTY_TYPES, ROOM_TYPES, type AmenityKey } from "@/lib/listingFields";

export type SortOrder = "newest" | "price_asc" | "price_desc";
export const SORTS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export const LEASE_FILTERS = [
  { value: "0", label: "Month-to-month" },
  { value: "6", label: "6 months or less" },
  { value: "12", label: "12 months or more" },
] as const;

export const LISTED_WITHIN = [
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
] as const;

export interface SearchFilters {
  /** City, neighborhood, ZIP code or words in the title. */
  q: string;
  /** Whole place or room to share (Listing.type). */
  type: "" | "APARTMENT_FOR_RENT" | "ROOM_TO_SHARE";
  propertyType: string;
  roomType: string;
  minPrice: number | null;
  maxPrice: number | null;
  /** How many people will live there (§5). */
  occupants: number | null;
  /** "0" (studio), "1", "2" or "3+". */
  bedrooms: string;
  /** At least this many. */
  bathrooms: number | null;
  /** YYYY-MM-DD: available by then. */
  moveIn: string;
  /** "0" month-to-month, "6" six months or less, "12" twelve months or more. */
  lease: string;
  amenities: AmenityKey[];
  laundry: boolean;
  smoking: "" | "free" | "allowed";
  noBrokerFee: boolean;
  noApplicationFee: boolean;
  /** Days since the listing was posted. */
  listedWithin: number | null;
  sort: SortOrder;
  /** Earlier roommate filter for rooms, still understood. */
  roommateLifestyleTag: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: "", type: "", propertyType: "", roomType: "", minPrice: null, maxPrice: null, occupants: null,
  bedrooms: "", bathrooms: null, moveIn: "", lease: "", amenities: [], laundry: false, smoking: "",
  noBrokerFee: false, noApplicationFee: false, listedWithin: null, sort: "newest", roommateLifestyleTag: "",
};

const num = (v: string | null) => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | "" => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : "";
const AMENITY_KEYS = AMENITIES.map(a => a.key);

/** Filters from the page address (older links used `city` for the place). */
export function parseFilters(p: URLSearchParams): SearchFilters {
  const occupants = num(p.get("occupants"));
  const bathrooms = num(p.get("bathrooms"));
  const listedWithin = num(p.get("listedWithin"));
  return {
    q: (p.get("q") ?? p.get("city") ?? "").trim().slice(0, 80),
    type: oneOf(p.get("type"), ["APARTMENT_FOR_RENT", "ROOM_TO_SHARE"] as const),
    propertyType: oneOf(p.get("propertyType"), PROPERTY_TYPES.map(t => t.value)),
    roomType: oneOf(p.get("roomType"), ROOM_TYPES.map(t => t.value)),
    minPrice: num(p.get("minPrice")),
    maxPrice: num(p.get("maxPrice")),
    occupants: occupants !== null && occupants >= 1 ? Math.min(Math.floor(occupants), 20) : null,
    bedrooms: oneOf(p.get("bedrooms"), ["0", "1", "2", "3+"] as const) || (num(p.get("bedrooms")) !== null && num(p.get("bedrooms"))! >= 3 ? "3+" : ""),
    bathrooms: bathrooms !== null && bathrooms >= 1 ? bathrooms : null,
    moveIn: /^\d{4}-\d{2}-\d{2}$/.test(p.get("moveIn") ?? "") ? p.get("moveIn")! : "",
    lease: oneOf(p.get("lease"), ["0", "6", "12"] as const),
    amenities: (p.get("amenities") ?? "").split(",").filter((a): a is AmenityKey => (AMENITY_KEYS as readonly string[]).includes(a)),
    laundry: p.get("laundry") === "1",
    smoking: oneOf(p.get("smoking"), ["free", "allowed"] as const),
    noBrokerFee: p.get("noBrokerFee") === "1",
    noApplicationFee: p.get("noApplicationFee") === "1",
    listedWithin: listedWithin !== null && listedWithin >= 1 ? Math.min(listedWithin, 365) : null,
    sort: oneOf(p.get("sort"), ["newest", "price_asc", "price_desc"] as const) || "newest",
    roommateLifestyleTag: (p.get("roommateLifestyleTag") ?? "").slice(0, 40),
  };
}

/** The page address for these filters (only what differs from no filter). */
export function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | null | boolean) => {
    if (v === null || v === "" || v === false) return;
    p.set(k, v === true ? "1" : String(v));
  };
  set("q", f.q.trim());
  set("type", f.type);
  set("propertyType", f.propertyType);
  set("roomType", f.roomType);
  set("minPrice", f.minPrice);
  set("maxPrice", f.maxPrice);
  set("occupants", f.occupants);
  set("bedrooms", f.bedrooms);
  set("bathrooms", f.bathrooms);
  set("moveIn", f.moveIn);
  set("lease", f.lease);
  set("amenities", f.amenities.join(","));
  set("laundry", f.laundry);
  set("smoking", f.smoking);
  set("noBrokerFee", f.noBrokerFee);
  set("noApplicationFee", f.noApplicationFee);
  set("listedWithin", f.listedWithin);
  if (f.sort !== "newest") p.set("sort", f.sort);
  set("roommateLifestyleTag", f.roommateLifestyleTag);
  return p;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const DAY = 86_400_000;

export interface FilterChip { key: string; label: string; clear: Partial<SearchFilters> }

/** The active filters as removable chips (§6), e.g. "Brooklyn", "Under $1,800", "2 people". */
export function activeChips(f: SearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: string, label: string, clear: Partial<SearchFilters>) => chips.push({ key, label, clear });
  if (f.q) add("q", f.q, { q: "" });
  if (f.type) add("type", f.type === "ROOM_TO_SHARE" ? "Rooms" : "Whole places", { type: "", roomType: "" });
  if (f.propertyType) add("propertyType", PROPERTY_TYPES.find(t => t.value === f.propertyType)!.label, { propertyType: "" });
  if (f.roomType) add("roomType", ROOM_TYPES.find(t => t.value === f.roomType)!.label, { roomType: "" });
  if (f.minPrice !== null && f.maxPrice !== null) add("price", `${money(f.minPrice)}–${money(f.maxPrice)}`, { minPrice: null, maxPrice: null });
  else if (f.maxPrice !== null) add("price", `Under ${money(f.maxPrice)}`, { maxPrice: null });
  else if (f.minPrice !== null) add("price", `From ${money(f.minPrice)}`, { minPrice: null });
  if (f.occupants) add("occupants", `${f.occupants} ${f.occupants === 1 ? "person" : "people"}`, { occupants: null });
  if (f.bedrooms) add("bedrooms", f.bedrooms === "0" ? "Studio" : f.bedrooms === "3+" ? "3+ bedrooms" : `${f.bedrooms} bedroom${f.bedrooms === "1" ? "" : "s"}`, { bedrooms: "" });
  if (f.bathrooms) add("bathrooms", `${f.bathrooms}+ bath${f.bathrooms === 1 ? "" : "s"}`, { bathrooms: null });
  if (f.moveIn) add("moveIn", `Move in by ${new Date(`${f.moveIn}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`, { moveIn: "" });
  if (f.lease) add("lease", LEASE_FILTERS.find(l => l.value === f.lease)!.label, { lease: "" });
  for (const a of f.amenities) add(`amenity:${a}`, AMENITIES.find(x => x.key === a)!.label, { amenities: f.amenities.filter(x => x !== a) });
  if (f.laundry) add("laundry", "Laundry", { laundry: false });
  if (f.smoking) add("smoking", f.smoking === "free" ? "Smoke-free" : "Smoking allowed", { smoking: "" });
  if (f.noBrokerFee) add("noBrokerFee", "No broker fee", { noBrokerFee: false });
  if (f.noApplicationFee) add("noApplicationFee", "No application fee", { noApplicationFee: false });
  if (f.listedWithin) add("listedWithin", LISTED_WITHIN.find(l => l.value === f.listedWithin)?.label ?? `Last ${f.listedWithin} days`, { listedWithin: null });
  if (f.roommateLifestyleTag) add("lifestyle", f.roommateLifestyleTag.replace(/-/g, " "), { roommateLifestyleTag: "" });
  return chips;
}

/** Only approved listings, matching every filter. */
export function searchWhere(f: SearchFilters, now = new Date()): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [{ status: "APPROVED" }];
  if (f.q) {
    and.push({ OR: [
      { city: { contains: f.q, mode: "insensitive" } },
      { neighborhood: { contains: f.q, mode: "insensitive" } },
      { zipCode: { startsWith: f.q } },
      { state: { equals: f.q, mode: "insensitive" } },
      { title: { contains: f.q, mode: "insensitive" } },
    ] });
  }
  if (f.type) and.push({ type: f.type });
  if (f.propertyType) and.push({ propertyType: f.propertyType });
  if (f.roomType) and.push({ roomType: f.roomType });
  if (f.minPrice !== null) and.push({ price: { gte: f.minPrice } });
  if (f.maxPrice !== null) and.push({ price: { lte: f.maxPrice } });
  if (f.occupants) and.push({ maxOccupants: { gte: f.occupants } });
  if (f.bedrooms) and.push({ bedrooms: f.bedrooms === "3+" ? { gte: 3 } : Number(f.bedrooms) });
  if (f.bathrooms) and.push({ bathrooms: { gte: f.bathrooms } });
  if (f.moveIn) and.push({ OR: [{ availableFrom: null }, { availableFrom: { lte: new Date(`${f.moveIn}T23:59:59.999Z`) } }] });
  if (f.lease === "0") and.push({ leaseMonths: 0 });
  if (f.lease === "6") and.push({ leaseMonths: { lte: 6 } });
  if (f.lease === "12") and.push({ leaseMonths: { gte: 12 } });
  for (const a of f.amenities) and.push({ [a]: true });
  if (f.laundry) and.push({ laundry: { in: ["IN_UNIT", "IN_BUILDING"] } });
  if (f.smoking) and.push({ smokingAllowed: f.smoking === "allowed" });
  if (f.noBrokerFee) and.push({ brokerFee: 0 });
  if (f.noApplicationFee) and.push({ applicationFee: 0 });
  if (f.listedWithin) and.push({ createdAt: { gte: new Date(now.getTime() - f.listedWithin * DAY) } });
  if (f.roommateLifestyleTag) and.push({ type: "ROOM_TO_SHARE", roommateLifestyleTags: { contains: `"${f.roommateLifestyleTag}"` } });
  return { AND: and };
}

export function searchOrderBy(f: SearchFilters): Prisma.ListingOrderByWithRelationInput[] {
  if (f.sort === "price_asc") return [{ price: "asc" }, { createdAt: "desc" }];
  if (f.sort === "price_desc") return [{ price: "desc" }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}
