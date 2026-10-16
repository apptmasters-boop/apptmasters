/**
 * The icon for each detail a listing states (Sprint 13e; the same icons as the
 * filters, docs/mockups/filters-mobile.jpg and listing-details-mobile.jpg),
 * keyed by the labels amenityLabels() returns.
 */
import {
  AccessibleIcon, BoltIcon, CarIcon, CheckIcon, DishwasherIcon, ElevatorIcon, FlameIcon, NoSmokeIcon, PawIcon, ShowerIcon,
  SnowflakeIcon, SofaIcon, WasherIcon, WifiIcon,
} from "@/components/landing/icons";

type IconType = (p: { className?: string }) => React.ReactNode;

const ICONS: Record<string, IconType> = {
  "Furnished": SofaIcon,
  "Wi-Fi included": WifiIcon,
  "Utilities included": BoltIcon,
  "Private bathroom": ShowerIcon,
  "Parking": CarIcon,
  "Elevator": ElevatorIcon,
  "Pets allowed": PawIcon,
  "Accessible": AccessibleIcon,
  "Air conditioning": SnowflakeIcon,
  "Heat included": FlameIcon,
  "Dishwasher": DishwasherIcon,
  "Laundry": WasherIcon,
  "Smoke-free": NoSmokeIcon,
};

export const amenityIcon = (label: string): IconType => ICONS[label] ?? CheckIcon;
