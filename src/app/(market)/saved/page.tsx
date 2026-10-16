"use client";
/**
 * Saved listings (Sprint 12; MARKETPLACE_FLOW.md §14, §18; designs
 * docs/mockups/saved-mobile.jpg, saved-desktop.jpg). Only for signed-in
 * people. Search and sort inside Saved; a listing that's no longer available
 * stays, labeled, until you remove it. Folders wait (not in the MVP).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/components/market/useMe";
import { useSavedIds, useSavedReady, toggleSaved } from "@/components/market/saved";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import { HeartIcon, MessageIcon, SearchIcon } from "@/components/landing/icons";

interface SavedRow { savedAt: string; listing: MarketListing }
type Sort = "recent" | "price_asc" | "price_desc";

function savedAgo(at: string) {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  return days <= 0 ? "Saved today" : days === 1 ? "Saved yesterday" : days < 7 ? `Saved ${days} days ago` : days < 14 ? "Saved 1 week ago" : `Saved ${Math.floor(days / 7)} weeks ago`;
}

export default function SavedPage() {
  const me = useMe();
  const savedIds = useSavedIds();
  const ready = useSavedReady();
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"" | "APARTMENT_FOR_RENT" | "ROOM_TO_SHARE">("");
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    if (!me) return;
    let current = true;
    async function load() {
      const res = await apiFetch("/api/saved");
      if (res.ok && current) setRows(await res.json());
    }
    load();
    return () => { current = false; };
  }, [me]);

  // Unsaving takes a card away (a heart turned off here or anywhere else on the page).
  const kept = useMemo(() => (rows ?? []).filter(r => !ready || savedIds.has(r.listing.id)), [rows, savedIds, ready]);
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = kept.filter(r => (!kind || r.listing.type === kind) &&
      (!q || [r.listing.title, r.listing.city, r.listing.neighborhood ?? "", r.listing.zipCode ?? ""].some(v => v.toLowerCase().includes(q))));
    if (sort === "price_asc") return [...list].sort((a, b) => a.listing.price - b.listing.price);
    if (sort === "price_desc") return [...list].sort((a, b) => b.listing.price - a.listing.price);
    return list;
  }, [kept, text, kind, sort]);

  if (me === null) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand"><HeartIcon className="h-8 w-8" /></span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Save the places you like</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Create a free account to keep listings in one place and come back to them later.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/signup?returnTo=/saved" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark">Sign up</Link>
          <Link href="/login?returnTo=/saved" className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">Log in</Link>
        </div>
      </main>
    );
  }

  const counts = {
    all: kept.length,
    APARTMENT_FOR_RENT: kept.filter(r => r.listing.type === "APARTMENT_FOR_RENT").length,
    ROOM_TO_SHARE: kept.filter(r => r.listing.type === "ROOM_TO_SHARE").length,
  };
  const kinds = [["", "All saved", counts.all], ["APARTMENT_FOR_RENT", "Whole places", counts.APARTMENT_FOR_RENT], ["ROOM_TO_SHARE", "Rooms", counts.ROOM_TO_SHARE]] as const;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8 lg:px-8 lg:pt-8">
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="px-2 text-lg font-bold text-gray-900 dark:text-white">Saved</h2>
          <ul className="mt-3 space-y-1">
            {kinds.map(([value, label, n]) => (
              <li key={label}>
                <button type="button" onClick={() => setKind(value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${kind === value ? "bg-brand-soft text-brand dark:bg-brand/25 dark:text-emerald-200" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}>
                  {label}<span className="rounded-full bg-white px-2 text-xs dark:bg-gray-800">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Saved</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{rows === null ? "Loading…" : `Your saved listings (${kept.length})`}</p>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Search your saved listings" aria-label="Search your saved listings"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900" />
            </label>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort saved listings"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium dark:border-gray-700 dark:bg-gray-900">
              <option value="recent">Recently saved</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        </div>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:hidden" role="tablist" aria-label="Kind of place">
          {kinds.map(([value, label, n]) => (
            <button key={label} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${kind === value ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"}`}>
              {label} ({n})
            </button>
          ))}
        </div>

        <div className="mt-5">
          {rows === null ? (
            <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
          ) : kept.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900">
              <HeartIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-900 dark:text-white">No saved listings yet</p>
              <p className="mt-1 text-sm text-gray-500">Tap the heart on a listing to keep it here.</p>
              <Link href="/listings" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Find a Home</Link>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">No saved listing matches &ldquo;{text}&rdquo;.</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {shown.map(r => (
                  <ListingCard key={r.listing.id} listing={r.listing} layout="row" footer={<SavedActions row={r} />} />
                ))}
              </div>
              <div className="hidden gap-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                {shown.map(r => (
                  <ListingCard key={r.listing.id} listing={{ ...r.listing, owner: undefined }} layout="grid"
                    footer={<p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800">{savedAgo(r.savedAt)}</p>} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function SavedActions({ row }: { row: SavedRow }) {
  const gone = row.listing.status !== "APPROVED";
  return (
    <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5">
      {gone ? (
        <button type="button" onClick={() => toggleSaved(row.listing.id)}
          className="col-span-2 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Remove from Saved
        </button>
      ) : (
        <>
          <Link href={`/listings/${row.listing.id}`} className="flex items-center justify-center rounded-xl border-2 border-brand py-2 text-sm font-semibold text-brand dark:text-emerald-300">View details</Link>
          <Link href={`/listings/${row.listing.id}/messages`} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <MessageIcon className="h-4 w-4" />Message
          </Link>
        </>
      )}
    </div>
  );
}
