"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, getToken, clearToken } from "@/lib/api";

export default function ListingsNav({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  // Phones: the links live in a menu (Sprint 11b quick fix; Sprint 12 brings one header for everything).
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) { setName(null); return; }
    apiFetch("/api/auth/me").then(async res => {
      if (res.ok) { const me = await res.json(); setName(me.name); }
    });
  }, [pathname]);

  const links = [
    { href: "/listings", label: "Browse" },
    { href: "/listings/new", label: "Post a listing" },
    ...(name ? [{ href: "/listings/mine", label: "My listings" }, { href: "/listings/inbox", label: "Messages" }] : []),
  ];
  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${pathname === href ? "text-blue-600" : "text-gray-500 hover:text-gray-800"}`;

  return (
    <header className="relative bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 sm:gap-6">
        {onOpenMenu ? (
          <button onClick={onOpenMenu} aria-label="Open menu"
            className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : (
          <button onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="listings-menu"
            className="sm:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 6l12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        )}
        <Link href="/listings" className="font-bold text-gray-900">
          ApptMasters <span className="text-blue-600">Listings</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-5">
          {links.map(l => <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>)}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {name ? (
          <>
            <span className="hidden sm:inline text-sm text-gray-500">{name}</span>
            <button
              onClick={() => { clearToken(); setName(null); router.push("/listings"); }}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login?returnTo=/listings" className="text-sm text-gray-500 hover:text-gray-800">Sign in</Link>
            <Link href="/signup" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Sign up
            </Link>
          </>
        )}
      </div>
      {menuOpen && !onOpenMenu && (
        <nav id="listings-menu" className="sm:hidden absolute inset-x-0 top-full z-40 border-b border-gray-200 bg-white px-4 py-2 shadow-md">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className={`block rounded-lg px-2 py-2.5 ${linkClass(l.href)}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
