import type { ComponentType } from "react";
import {
  BedIcon, BuildingIcon, QuietIcon, NoSmokeIcon, PawIcon, CapIcon, SunriseIcon, MoonIcon,
} from "./icons";

type Icon = ComponentType<{ className?: string }>;

// Listing.type values understood by /api/listings
export const TYPE_OPTIONS: { value: string; label: string; icon: Icon }[] = [
  { value: "ROOM_TO_SHARE", label: "Room to share", icon: BedIcon },
  { value: "APARTMENT_FOR_RENT", label: "Whole apartment", icon: BuildingIcon },
];

export const TYPE_LABELS: Record<string, string> = {
  ROOM_TO_SHARE: "Room to share",
  APARTMENT_FOR_RENT: "Apartment for rent",
};

// Keys match LIFESTYLE_OPTIONS in listings/_components/ListingForm.tsx.
// The API only filters by lifestyle tag for ROOM_TO_SHARE listings.
export const LIFESTYLE_OPTIONS: { value: string; label: string; icon: Icon }[] = [
  { value: "quiet-household", label: "Quiet home", icon: QuietIcon },
  { value: "non-smoker", label: "Non-smoker", icon: NoSmokeIcon },
  { value: "pet-friendly", label: "Pet-friendly", icon: PawIcon },
  { value: "student-friendly", label: "Student-friendly", icon: CapIcon },
  { value: "early-riser", label: "Early riser", icon: SunriseIcon },
  { value: "night-owl", label: "Night owl", icon: MoonIcon },
];

export const BUDGET_OPTIONS = [
  { value: "", label: "Any budget" },
  { value: "800", label: "Up to $800" },
  { value: "1200", label: "Up to $1,200" },
  { value: "1800", label: "Up to $1,800" },
  { value: "2500", label: "Up to $2,500" },
  { value: "3500", label: "Up to $3,500" },
];

export interface ListingSearch {
  city: string;
  type: string;
  maxPrice: string;
  roommateLifestyleTag: string;
}

export function searchToQuery(s: ListingSearch): string {
  const params = new URLSearchParams();
  if (s.city.trim()) params.set("city", s.city.trim());
  // A lifestyle tag only applies to rooms, so it implies that type.
  const type = s.roommateLifestyleTag ? "ROOM_TO_SHARE" : s.type;
  if (type) params.set("type", type);
  if (s.maxPrice) params.set("maxPrice", s.maxPrice);
  if (s.roommateLifestyleTag) params.set("roommateLifestyleTag", s.roommateLifestyleTag);
  return params.toString();
}
