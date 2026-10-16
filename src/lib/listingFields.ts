/**
 * The listing details "Find a Home" searches on (Sprint 12;
 * docs/MARKETPLACE_FLOW.md §4–§6, §9, §28). No database access, so the listing
 * form, the cards and the server share it. Every detail is optional ("not
 * stated") except how many people can live there (§5: declared, never guessed
 * from the bedrooms).
 */
import { z } from "zod";

export const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "HOUSE", label: "House" },
  { value: "STUDIO", label: "Studio" },
] as const;

export const ROOM_TYPES = [
  { value: "PRIVATE_ROOM", label: "Private room" },
  { value: "SHARED_ROOM", label: "Shared room" },
] as const;

export const LAUNDRY_OPTIONS = [
  { value: "IN_UNIT", label: "In the unit" },
  { value: "IN_BUILDING", label: "In the building" },
  { value: "NONE", label: "No laundry" },
] as const;

/** Shortest lease, in months (0 = month-to-month). */
export const LEASE_OPTIONS = [
  { value: 0, label: "Month-to-month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
] as const;

/** Yes/no details, in the order cards, the listing page and the filters show them. */
export const AMENITIES = [
  { key: "furnished", label: "Furnished" },
  { key: "internetIncluded", label: "Wi-Fi included" },
  { key: "utilitiesIncluded", label: "Utilities included" },
  { key: "privateBathroom", label: "Private bathroom" },
  { key: "parking", label: "Parking" },
  { key: "elevator", label: "Elevator" },
  { key: "petsAllowed", label: "Pets allowed" },
  { key: "accessible", label: "Accessible" },
  { key: "airConditioning", label: "Air conditioning" },
  { key: "heatIncluded", label: "Heat included" },
  { key: "dishwasher", label: "Dishwasher" },
] as const;
export type AmenityKey = (typeof AMENITIES)[number]["key"];

export interface ListingDetails {
  maxOccupants: number | null;
  neighborhood: string | null;
  zipCode: string | null;
  propertyType: string | null;
  roomType: string | null;
  furnished: boolean | null;
  leaseMonths: number | null;
  utilitiesIncluded: boolean | null;
  internetIncluded: boolean | null;
  privateBathroom: boolean | null;
  laundry: string | null;
  parking: boolean | null;
  elevator: boolean | null;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  accessible: boolean | null;
  airConditioning: boolean | null;
  heatIncluded: boolean | null;
  dishwasher: boolean | null;
  squareFeet: number | null;
  brokerFee: number | null;
  applicationFee: number | null;
}

const label = <T extends { value: string | number; label: string }>(list: readonly T[], value: unknown) =>
  list.find(o => o.value === value)?.label ?? null;
export const propertyTypeLabel = (v: string | null) => label(PROPERTY_TYPES, v);
export const roomTypeLabel = (v: string | null) => label(ROOM_TYPES, v);
export const laundryLabel = (v: string | null) => label(LAUNDRY_OPTIONS, v);
export const leaseLabel = (months: number | null) =>
  months === null ? null : months === 0 ? "Month-to-month" : `${months}-month lease`;

/** What kind of place, in a word or two: "Private room", "Apartment", "Room". */
export function placeKind(l: { type: string; propertyType?: string | null; roomType?: string | null }) {
  if (l.type === "ROOM_TO_SHARE") return roomTypeLabel(l.roomType ?? null) ?? "Room";
  return propertyTypeLabel(l.propertyType ?? null) ?? "Whole place";
}

/** The details a listing states as "yes" (and its laundry), for chips. */
export function amenityLabels(l: Partial<ListingDetails>): string[] {
  const labels: string[] = AMENITIES.filter(a => l[a.key] === true).map(a => a.label);
  if (l.laundry === "IN_UNIT" || l.laundry === "IN_BUILDING") labels.splice(2, 0, "Laundry");
  if (l.smokingAllowed === false) labels.push("Smoke-free");
  return labels;
}

/** A fee as people read it: "No broker fee", "Broker fee $500", or null when not stated. */
export function feeLabel(name: string, fee: number | null): string | null {
  if (fee === null || fee === undefined) return null;
  return fee === 0 ? `No ${name.toLowerCase()}` : `${name} $${fee.toLocaleString("en-US")}`;
}

/** Validation for the details on the listing form (create and edit). */
export const detailsSchema = z.object({
  maxOccupants: z.number({ message: "Say how many people can live there" }).int().min(1, "At least 1 person").max(20, "20 people at most"),
  neighborhood: z.string().trim().max(80).optional(),
  zipCode: z.string().trim().regex(/^\d{5}$/, "ZIP code: 5 digits").optional(),
  propertyType: z.enum(["APARTMENT", "HOUSE", "STUDIO"]).optional(),
  roomType: z.enum(["PRIVATE_ROOM", "SHARED_ROOM"]).optional(),
  furnished: z.boolean().optional(),
  leaseMonths: z.number().int().min(0).max(60).optional(),
  utilitiesIncluded: z.boolean().optional(),
  internetIncluded: z.boolean().optional(),
  privateBathroom: z.boolean().optional(),
  laundry: z.enum(["IN_UNIT", "IN_BUILDING", "NONE"]).optional(),
  parking: z.boolean().optional(),
  elevator: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
  accessible: z.boolean().optional(),
  airConditioning: z.boolean().optional(),
  heatIncluded: z.boolean().optional(),
  dishwasher: z.boolean().optional(),
  squareFeet: z.number().int("Square feet: a whole number").min(50, "At least 50 square feet").max(20_000, "20,000 square feet at most").optional(),
  brokerFee: z.number().min(0, "Enter 0 for no fee").max(100_000).optional(),
  applicationFee: z.number().min(0, "Enter 0 for no fee").max(10_000).optional(),
});
export type DetailsInput = z.infer<typeof detailsSchema>;

/** The details as stored: not stated → null; the room type only for rooms to share. */
export function detailsData(d: DetailsInput, type: string): ListingDetails {
  return {
    maxOccupants: d.maxOccupants,
    neighborhood: d.neighborhood || null,
    zipCode: d.zipCode || null,
    propertyType: d.propertyType ?? null,
    roomType: type === "ROOM_TO_SHARE" ? d.roomType ?? null : null,
    furnished: d.furnished ?? null,
    leaseMonths: d.leaseMonths ?? null,
    utilitiesIncluded: d.utilitiesIncluded ?? null,
    internetIncluded: d.internetIncluded ?? null,
    privateBathroom: d.privateBathroom ?? null,
    laundry: d.laundry ?? null,
    parking: d.parking ?? null,
    elevator: d.elevator ?? null,
    petsAllowed: d.petsAllowed ?? null,
    smokingAllowed: d.smokingAllowed ?? null,
    accessible: d.accessible ?? null,
    airConditioning: d.airConditioning ?? null,
    heatIncluded: d.heatIncluded ?? null,
    dishwasher: d.dishwasher ?? null,
    squareFeet: d.squareFeet ?? null,
    brokerFee: d.brokerFee ?? null,
    applicationFee: d.applicationFee ?? null,
  };
}
