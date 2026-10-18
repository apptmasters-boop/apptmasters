"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/api";
import { HubPage, HubSection, type HubItem } from "@/components/home/HubPage";
import { useApartment } from "@/components/home/useApartment";
import {
  WrenchIcon, ScaleIcon, CalendarIcon, ChartIcon, StarIcon, ClipboardCheckIcon, SearchDocIcon,
  BellIcon, SearchIcon, HomeIcon, UserIcon, SettingsIcon, LogOutIcon, MessageIcon, ShieldCheckIcon, HelpCircleIcon,
} from "@/components/landing/icons";

// More tab (PRODUCT_LOGIC §17): secondary navigation, grouped. Also holds the
// features the owner kept that aren't in the blueprint (scores, agreements,
// audit). Calls live in Chat. The Admin link is only for platform admins.
export default function MorePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { isAdmin: isHouseholdAdmin } = useApartment(id);
  const at = (path: string) => `/apartment/${id}/${path}`;

  useEffect(() => {
    apiFetch("/api/auth/me").then(async res => {
      if (res.ok) setIsSuperAdmin((await res.json()).systemRole === "SUPER_ADMIN");
    });
  }, []);

  const account: HubItem[] = [
    { href: "/profile", label: "My profile", description: "Your details and your homes", icon: UserIcon },
    { href: "/settings", label: "Settings", description: "Personal information, notifications, login & security", icon: SettingsIcon },
    { href: at("notifications"), label: "Notifications", description: "Everything that happened for you", icon: BellIcon },
    // Phones have no footer since fix F16: Help is here.
    { href: "/help", label: "Help & support", description: "Answers to the questions people ask most", icon: HelpCircleIcon },
  ];
  if (isSuperAdmin) {
    account.push({ href: "/admin", label: "Admin", description: "Platform administration", icon: SettingsIcon });
  }

  return (
    <HubPage title="More">
      {isHouseholdAdmin && (
        <HubSection title="For household admins" items={[
          { href: at("settings"), label: "Home settings", description: "Join requests, members, roles, announcement", icon: SettingsIcon },
        ]} />
      )}
      <HubSection title="Home management" items={[
        { href: at("maintenance"), label: "Maintenance", description: "Report and follow repairs", icon: WrenchIcon },
        { href: at("issues"), label: "Household issues", description: "Raise and resolve concerns together", icon: ScaleIcon },
        { href: at("calendar"), label: "Calendar", description: "Household events and dates", icon: CalendarIcon },
      ]} />
      <HubSection title="Insights" items={[
        { href: at("feed"), label: "Activity", description: "What's been happening at home", icon: MessageIcon },
        { href: at("insights"), label: "Insights", description: "Spending, rent and who does what", icon: ChartIcon },
      ]} />
      <HubSection title="Household records" items={[
        { href: at("scores"), label: "Roommate scores", description: "Points for keeping up with the house", icon: StarIcon },
        { href: at("agreements"), label: "Shared agreements", description: "What the household has agreed on", icon: ClipboardCheckIcon },
        { href: at("audit"), label: "Audit log", description: "History of important changes", icon: ShieldCheckIcon },
        { href: at("search"), label: "Search", description: "Find anything in this home", icon: SearchDocIcon },
      ]} />
      <HubSection title="Marketplace" items={[
        { href: "/listings", label: "Search listings", description: "Rooms and apartments", icon: SearchIcon },
        { href: "/listings/mine", label: "My listings", description: "Places you've posted", icon: HomeIcon },
      ]} />
      <HubSection title="Account" items={account} />
      <button type="button" onClick={() => { clearToken(); router.replace("/login"); }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50">
        <LogOutIcon className="h-4 w-4" />
        Sign out
      </button>
    </HubPage>
  );
}
