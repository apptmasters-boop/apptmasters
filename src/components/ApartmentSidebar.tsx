"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import IconBadge from "./IconBadge";
import {
  ChoresIcon, CleaningIcon, GroceryIcon, InventoryIcon, FinanceIcon, RentIcon,
  FundIcon, CalendarIcon, RoomsIcon, ChatIcon, MaintenanceIcon, DisputesIcon,
  ActivityIcon, StatsIcon, HouseIcon, ProfileIcon, AdminIcon,
} from "./icons";
import type { CategoryColor } from "@/lib/categoryStyle";

interface Props {
  apartmentId: string;
  apartmentName: string;
  isSuperAdmin: boolean;
}

const HOUSEHOLD_LINKS: { label: string; path: string; icon: React.ReactNode; color: CategoryColor }[] = [
  { label: "Chores", path: "chores", icon: <ChoresIcon />, color: "orange" },
  { label: "Cleaning", path: "cleaning", icon: <CleaningIcon />, color: "cyan" },
  { label: "Groceries", path: "grocery", icon: <GroceryIcon />, color: "green" },
  { label: "Inventory", path: "inventory", icon: <InventoryIcon />, color: "purple" },
  { label: "Finance", path: "finance", icon: <FinanceIcon />, color: "blue" },
  { label: "Rent", path: "rent", icon: <RentIcon />, color: "rose" },
  { label: "Shared Fund", path: "fund", icon: <FundIcon />, color: "teal" },
  { label: "Calendar", path: "calendar", icon: <CalendarIcon />, color: "sky" },
  { label: "Rooms", path: "rooms", icon: <RoomsIcon />, color: "violet" },
  { label: "Chat", path: "chat", icon: <ChatIcon />, color: "emerald" },
  { label: "Maintenance", path: "maintenance", icon: <MaintenanceIcon />, color: "amber" },
  { label: "Disputes", path: "disputes", icon: <DisputesIcon />, color: "red" },
  { label: "Activity", path: "feed", icon: <ActivityIcon />, color: "indigo" },
  { label: "Stats", path: "stats", icon: <StatsIcon />, color: "teal" },
];

const MARKETPLACE_LINKS: { label: string; path: string; root: boolean; icon: React.ReactNode; color: CategoryColor }[] = [
  { label: "Search Listings", path: "listings", root: true, icon: <HouseIcon />, color: "blue" },
  { label: "My Listings", path: "listings/mine", root: true, icon: <ActivityIcon />, color: "gray" },
];

export default function ApartmentSidebar({ apartmentId, apartmentName, isSuperAdmin }: Props) {
  const pathname = usePathname();

  function linkClass(href: string) {
    const active = pathname === href;
    return `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
      active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-100"
    }`;
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col border-r border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <HouseIcon className="w-[18px] h-[18px] text-white" />
        </span>
        <p className="font-bold text-gray-900 truncate">{apartmentName}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        <Link href={`/apartment/${apartmentId}`} className={linkClass(`/apartment/${apartmentId}`)}>
          <IconBadge icon={<StatsIcon />} color="indigo" size="sm" />
          Dashboard
        </Link>

        <div>
          <p className="px-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Household</p>
          <div className="space-y-0.5">
            {HOUSEHOLD_LINKS.map(l => (
              <Link key={l.path} href={`/apartment/${apartmentId}/${l.path}`} className={linkClass(`/apartment/${apartmentId}/${l.path}`)}>
                <IconBadge icon={l.icon} color={l.color} size="sm" />
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="px-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Marketplace</p>
          <div className="space-y-0.5">
            {MARKETPLACE_LINKS.map(l => (
              <Link key={l.path} href={`/${l.path}`} className={linkClass(`/${l.path}`)}>
                <IconBadge icon={l.icon} color={l.color} size="sm" />
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link href="/profile" className={linkClass("/profile")}>
          <IconBadge icon={<ProfileIcon />} color="indigo" size="sm" />
          Profile
        </Link>
        {isSuperAdmin && (
          <Link href="/admin" className={linkClass("/admin")}>
            <IconBadge icon={<AdminIcon />} color="slate" size="sm" />
            Admin
          </Link>
        )}
      </div>
    </aside>
  );
}
