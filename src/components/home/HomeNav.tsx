"use client";
/**
 * "My Home" navigation (docs/PRODUCT_LOGIC.md §5): a side menu on computers and
 * a bottom bar on phones with the same five destinations, plus the back link
 * used on section pages. The rules for which page belongs where live in
 * src/lib/homeNav.ts.
 */
import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { HOME_TABS, homeNavState, tabHref, type HomeTab } from "@/lib/homeNav";
import { Logo } from "@/components/landing/SiteChrome";
import { HomeIcon, UsersIcon, DollarIcon, MessageIcon, MoreIcon, ArrowLeftIcon } from "@/components/landing/icons";

const TAB_ICONS: Record<HomeTab, ComponentType<{ className?: string }>> = {
  home: HomeIcon, household: UsersIcon, money: DollarIcon, chat: MessageIcon, more: MoreIcon,
};

/** Unread chat messages for the badge; refreshed on navigation and every 30 s. */
export function useChatUnread(apartmentId: string) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch(`/api/apartments/${apartmentId}/chat/unread`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelled && d) setCount(d.total); })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [apartmentId, pathname]);
  return count;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white"
      aria-label={`${count} unread`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Side menu, computers only (md and up). */
export function HomeSidebar({ apartmentId, apartmentName, unread }: { apartmentId: string; apartmentName: string; unread: number }) {
  const { tab: active } = homeNavState(usePathname(), apartmentId);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="border-b border-gray-100 px-5 py-4">
        <Logo />
        <p className="mt-3 truncate text-sm font-semibold text-gray-900" title={apartmentName}>{apartmentName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="My Home">
        {HOME_TABS.map(({ tab, label }) => {
          const Icon = TAB_ICONS[tab];
          const isActive = tab === active;
          return (
            <Link key={tab} href={tabHref(apartmentId, tab)} aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200" : "text-gray-600 hover:bg-gray-100"}`}>
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {tab === "chat" && <Badge count={unread} />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Bottom bar, phones only (below md). */
export function HomeBottomBar({ apartmentId, unread }: { apartmentId: string; unread: number }) {
  const { tab: active } = homeNavState(usePathname(), apartmentId);
  return (
    <nav aria-label="My Home"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid h-16 grid-cols-5">
        {HOME_TABS.map(({ tab, label }) => {
          const Icon = TAB_ICONS[tab];
          const isActive = tab === active;
          return (
            <li key={tab}>
              <Link href={tabHref(apartmentId, tab)} aria-current={isActive ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? "text-brand dark:text-emerald-300" : "text-gray-500"}`}>
                <Icon className="h-6 w-6" />
                {label}
                {tab === "chat" && unread > 0 && (
                  <span className="absolute left-1/2 top-1.5 ml-1.5"><Badge count={unread} /></span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "← Household" style link for section pages; renders nothing on primary pages. */
export function BackLink() {
  const { id } = useParams<{ id: string }>();
  const { back } = homeNavState(usePathname(), id);
  if (!back) return null;
  return (
    <Link href={back.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800">
      <ArrowLeftIcon className="h-4 w-4" />
      {back.label}
    </Link>
  );
}
