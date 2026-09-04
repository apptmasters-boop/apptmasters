"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  apartmentId: string;
  apartmentName: string;
  isSuperAdmin: boolean;
}

const HOUSEHOLD_LINKS = [
  { label: "Chores", path: "chores" },
  { label: "Cleaning", path: "cleaning" },
  { label: "Groceries", path: "grocery" },
  { label: "Inventory", path: "inventory" },
  { label: "Finance", path: "finance" },
  { label: "Rent", path: "rent" },
  { label: "Shared Fund", path: "fund" },
  { label: "Calendar", path: "calendar" },
  { label: "Rooms", path: "rooms" },
  { label: "Chat", path: "chat" },
  { label: "Maintenance", path: "maintenance" },
  { label: "Disputes", path: "disputes" },
  { label: "Activity", path: "feed" },
  { label: "Stats", path: "stats" },
];

const MARKETPLACE_LINKS = [
  { label: "Search Listings", path: "listings", root: true },
  { label: "My Listings", path: "listings/mine", root: true },
];

export default function ApartmentSidebar({ apartmentId, apartmentName, isSuperAdmin }: Props) {
  const pathname = usePathname();

  function linkClass(href: string) {
    const active = pathname === href;
    return `block px-3 py-1.5 rounded-lg text-sm transition-colors ${
      active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-100"
    }`;
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-shrink-0 md:flex-col border-r border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="font-bold text-gray-900 truncate">{apartmentName}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        <Link href={`/apartment/${apartmentId}`} className={linkClass(`/apartment/${apartmentId}`)}>
          Dashboard
        </Link>

        <div>
          <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Household</p>
          <div className="space-y-0.5">
            {HOUSEHOLD_LINKS.map(l => (
              <Link key={l.path} href={`/apartment/${apartmentId}/${l.path}`} className={linkClass(`/apartment/${apartmentId}/${l.path}`)}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Marketplace</p>
          <div className="space-y-0.5">
            {MARKETPLACE_LINKS.map(l => (
              <Link key={l.path} href={`/${l.path}`} className={linkClass(`/${l.path}`)}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link href="/profile" className={linkClass("/profile")}>Profile</Link>
        {isSuperAdmin && <Link href="/admin" className={linkClass("/admin")}>Admin</Link>}
      </div>
    </aside>
  );
}
