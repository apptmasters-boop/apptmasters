"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, getToken, clearToken } from "@/lib/api";

export default function ListingsNav({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { setName(null); return; }
    apiFetch("/api/auth/me").then(async res => {
      if (res.ok) { const me = await res.json(); setName(me.name); }
    });
  }, [pathname]);

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${pathname === href ? "text-indigo-600" : "text-gray-500 hover:text-gray-800"}`;

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 sm:gap-6">
        {onOpenMenu && (
          <button onClick={onOpenMenu} aria-label="Open menu"
            className="md:hidden p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Link href="/listings" className="font-bold text-gray-900">
          ApptMasters <span className="text-indigo-600">Listings</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-5">
          <Link href="/listings" className={linkClass("/listings")}>Browse</Link>
          <Link href="/listings/new" className={linkClass("/listings/new")}>Post a listing</Link>
          {name && <Link href="/listings/mine" className={linkClass("/listings/mine")}>My listings</Link>}
          {name && <Link href="/listings/inbox" className={linkClass("/listings/inbox")}>Messages</Link>}
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
            <Link href="/listings/signup" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
