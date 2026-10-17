import type { ComponentType } from "react";
import { BedIcon, BuildingIcon } from "./icons";

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
  /** How many people will live there (MARKETPLACE_FLOW.md §3, §5). */
  occupants: string;
}

export const OCCUPANT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1 person" },
  { value: "2", label: "2 people" },
  { value: "3", label: "3 people" },
  { value: "4", label: "4 people" },
  { value: "5", label: "5+ people" },
];

export function searchToQuery(s: ListingSearch): string {
  const params = new URLSearchParams();
  if (s.city.trim()) params.set("q", s.city.trim());
  if (s.type) params.set("type", s.type);
  if (s.maxPrice) params.set("maxPrice", s.maxPrice);
  if (s.occupants) params.set("occupants", s.occupants);
  return params.toString();
}
