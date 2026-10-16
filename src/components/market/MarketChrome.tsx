"use client";
/**
 * The marketplace frame (Sprint 12; MARKETPLACE_FLOW.md §13, §21, §26; designs
 * in docs/mockups/): one header on every Find a Home page, a bottom bar on
 * phones, and the save that a visitor started before signing in.
 *
 *   Visitor           Home · Find a Home · How It Works · More · Log in · Sign up
 *   Signed in         Home · Find a Home · Messages · Saved · How It Works · More · avatar
 *   Phone bar         Home · Saved · Messages · More (visitors: Home · Find a Home · Saved · More)
 *
 * People who live in a home keep their household navigation here (§25).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/api";
import { HomeSidebar, HomeBottomBar, useChatUnread } from "@/components/home/HomeNav";
import { Logo } from "@/components/landing/SiteChrome";
import { useMe, forgetMe, initials, type Me } from "./useMe";
import { loadSaved, completeSaveIntent } from "./saved";
import {
  ChevronDownIcon, HeartIcon, HomeIcon, MessageIcon, MoreIcon, SearchIcon,
} from "@/components/landing/icons";

/** The wordmark, shared with the sign-in pages and the household sidebar. */
export const MarketLogo = Logo;

/** Unread marketplace conversations, for the dot on Messages. */
function useMarketUnread(signedIn: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    async function load() {
      const res = await apiFetch("/api/listings/inbox").catch(() => null);
      if (!res?.ok) return;
      const list: { unread: boolean }[] = await res.json();
      if (current) setUnread(list.filter(c => c.unread).length);
    }
    load();
    return () => { current = false; };
  }, [signedIn]);
  return unread;
}

function Avatar({ me, size = "h-9 w-9" }: { me: Me; size?: string }) {
  return me.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={me.photo} alt="" className={`${size} rounded-full border border-gray-200 object-cover`} />
  ) : (
    <span className={`flex ${size} items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200`}>{initials(me.name)}</span>
  );
}

function signOut(router: ReturnType<typeof useRouter>) {
  clearToken();
  forgetMe();
  router.push("/");
  router.refresh();
}

/** Desktop: the menu under the avatar; under "More" for visitors. */
function Dropdown({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300">
        {label}<ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {children}
        </div>
      )}
    </div>
  );
}
const menuItem = "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800";

export function MarketHeader({ me, unread }: { me: Me | null | undefined; unread: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const signedIn = !!me;
  const links = [
    { href: "/", label: "Home" },
    { href: "/listings", label: "Find a Home" },
    ...(signedIn ? [{ href: "/listings/inbox", label: "Messages" }, { href: "/saved", label: "Saved" }] : []),
    { href: "/how-it-works", label: "How It Works" },
  ];
  const inMessages = pathname.startsWith("/listings/inbox") || /^\/listings\/[^/]+\/messages/.test(pathname);
  const active = (href: string) =>
    href === "/" ? pathname === "/"
      : href === "/listings/inbox" ? inMessages
      : href === "/listings" ? !inMessages && (pathname === "/listings" || /^\/listings\/(?!inbox|mine|new)/.test(pathname))
      : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-10">
          <MarketLogo />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`relative py-5 text-sm font-medium transition-colors ${active(l.href) ? "text-gray-900 dark:text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-400"}`}>
                {l.label}
                {l.href === "/listings/inbox" && unread > 0 && <span className="absolute -right-2.5 top-4 h-2 w-2 rounded-full bg-red-500" aria-label={`${unread} unread`} />}
                {active(l.href) && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
              </Link>
            ))}
            <Dropdown label="More">
              {signedIn ? (
                <>
                  <Link href="/apartment/create" className={menuItem}>Create a Home</Link>
                  <Link href="/apartment/join" className={menuItem}>Join a Home</Link>
                  <Link href="/listings/mine" className={menuItem}>My listings</Link>
                  <Link href="/listings/new" className={menuItem}>Post a listing</Link>
                  <Link href="/help" className={menuItem}>Help</Link>
                </>
              ) : (
                <>
                  <Link href="/listings/new" className={menuItem}>Post a listing</Link>
                  <Link href="/help" className={menuItem}>Help</Link>
                </>
              )}
            </Dropdown>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/listings" aria-label="Search" className="hidden rounded-xl border border-gray-200 p-2.5 text-gray-700 hover:bg-gray-50 sm:block lg:hidden dark:border-gray-700 dark:text-gray-200">
            <SearchIcon className="h-5 w-5" />
          </Link>
          {me === undefined ? (
            <span className="h-9 w-24" aria-hidden />
          ) : me ? (
            <>
              <Link href="/more" className="lg:hidden" aria-label="Your account"><Avatar me={me} /></Link>
              <div className="hidden lg:block">
                <Dropdown label={<span className="flex items-center gap-2"><Avatar me={me} /><span className="max-w-32 truncate text-gray-800 dark:text-gray-100">{me.name.split(" ")[0]}</span></span>}>
                  <Link href="/profile" className={menuItem}>Profile</Link>
                  <Link href="/profile" className={menuItem}>Settings &amp; notifications</Link>
                  <Link href="/more" className={menuItem}>More</Link>
                  <button type="button" onClick={() => signOut(router)} className={`${menuItem} w-full text-left text-red-600`}>Sign out</button>
                </Dropdown>
              </div>
            </>
          ) : (
            <>
              <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100">
                Log in
              </Link>
              <Link href={`/signup?returnTo=${encodeURIComponent(pathname)}`}
                className="hidden rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:block">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketBottomNav({ me, unread }: { me: Me | null | undefined; unread: number }) {
  const pathname = usePathname();
  const tabs = me
    ? [
        { href: "/", label: "Home", icon: HomeIcon },
        { href: "/saved", label: "Saved", icon: HeartIcon },
        { href: "/listings/inbox", label: "Messages", icon: MessageIcon, dot: unread > 0 },
        { href: "/more", label: "More", icon: MoreIcon },
      ]
    : [
        { href: "/", label: "Home", icon: HomeIcon },
        { href: "/listings", label: "Find a Home", icon: SearchIcon },
        { href: "/saved", label: "Saved", icon: HeartIcon },
        { href: "/more", label: "More", icon: MoreIcon },
      ];
  const isActive = (href: string) =>
    href === "/" ? pathname === "/"
      : href === "/listings/inbox" ? pathname.startsWith(href) || /^\/listings\/[^/]+\/messages/.test(pathname)
      : pathname.startsWith(href);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-gray-800 dark:bg-gray-950">
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon, ...t }) => (
          <li key={href}>
            <Link href={href} aria-current={isActive(href) ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium ${isActive(href) ? "text-brand dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"}`}>
              <span className="relative">
                <Icon className="h-6 w-6" />
                {"dot" in t && t.dot && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
              </span>
              {label}
              {isActive(href) && <span className="absolute bottom-0.5 h-0.5 w-8 rounded-full bg-brand" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A short message at the bottom ("Saved"). */
export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      <span className="rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</span>
    </div>
  );
}

/**
 * Every Find a Home page: the header, the phone bar (or the household
 * navigation for people who live in a home), and finishing a save started
 * before signing in.
 */
export function MarketShell({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const me = useMe();
  const unread = useMarketUnread(!!me);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!me) return;
    let current = true;
    async function finish() {
      await loadSaved(true);
      const saved = await completeSaveIntent();
      if (saved && current) { setToast("Saved"); setTimeout(() => setToast(""), 2500); }
    }
    finish();
    return () => { current = false; };
  }, [me]);

  const home = me?.homes[0];
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {home && <ResidentNav home={home} />}
      <div className={home ? "pb-16 md:pb-0 md:pl-64" : "pb-20 lg:pb-0"}>
        {!bare && <MarketHeader me={me} unread={unread} />}
        {children}
      </div>
      {!home && <MarketBottomNav me={me} unread={unread} />}
      <Toast message={toast} />
    </div>
  );
}

function ResidentNav({ home }: { home: { id: string; name: string } }) {
  const unread = useChatUnread(home.id);
  return (
    <>
      <HomeSidebar apartmentId={home.id} apartmentName={home.name} unread={unread} />
      <HomeBottomBar apartmentId={home.id} unread={unread} />
    </>
  );
}
