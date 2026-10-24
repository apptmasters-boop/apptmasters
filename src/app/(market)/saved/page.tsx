"use client";
/**
 * Saved listings (Sprint 12, look matched to the pictures in Sprint 13f;
 * MARKETPLACE_FLOW.md §14, §18; designs docs/mockups/saved-mobile.jpg,
 * saved-desktop.jpg). Only for signed-in people. Search and sort inside
 * Saved; apartments, rooms and houses as in Find a Home; a listing that's no
 * longer available stays, labeled, until you remove it. Saved searches and
 * folders wait (not in the app yet).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/components/market/useMe";
import { useSavedIds, useSavedReady, toggleSaved } from "@/components/market/saved";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import {
  BedIcon, BuildingIcon, GridIcon, HeartIcon, HomeIcon, ListIcon, MessageIcon, MoreIcon, SearchIcon, ShareIcon, SortIcon, XIcon,
} from "@/components/landing/icons";

interface SavedRow { savedAt: string; listing: MarketListing }
type Sort = "recent" | "price_asc" | "price_desc";
type Kind = "" | "apartment" | "room" | "house";

const SORTS: [Sort, string][] = [["recent", "Recently saved"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]];
const VIEW_KEY = "am:savedView";

function savedAgo(at: string) {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  return days <= 0 ? "Saved today" : days === 1 ? "Saved yesterday" : days < 7 ? `Saved ${days} days ago` : days < 14 ? "Saved 1 week ago" : `Saved ${Math.floor(days / 7)} weeks ago`;
}

/** The same kinds as the Find a Home tabs (src/lib/listingSearch.ts KINDS). */
function kindOf(l: MarketListing): Kind {
  if (l.type === "ROOM_TO_SHARE") return "room";
  return l.propertyType === "HOUSE" ? "house" : "apartment";
}

/** A small menu that closes when you tap elsewhere. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return { open, setOpen, ref };
}
const menuItem = "flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800";

/** "…" on a card: View details, Share, Remove from Saved. */
function CardMenu({ listing }: { listing: MarketListing }) {
  const { open, setOpen, ref } = useMenu();
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/listings/${listing.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: listing.title, url }); setOpen(false); }
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => { setCopied(false); setOpen(false); }, 1500); }
    } catch { /* the person closed the share sheet */ }
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="More actions" aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
        <MoreIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <Link href={`/listings/${listing.id}`} className={menuItem}><HomeIcon className="h-4 w-4" />View details</Link>
          <button type="button" onClick={share} className={menuItem}><ShareIcon className="h-4 w-4" />{copied ? "Link copied" : "Share"}</button>
          <button type="button" onClick={() => toggleSaved(listing.id)} className={`${menuItem} text-red-600 dark:text-red-400`}>
            <HeartIcon className="h-4 w-4" />Remove from Saved
          </button>
        </div>
      )}
    </div>
  );
}

/** Phones: "…" next to the title sorts the list. */
function SortMenu({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const { open, setOpen, ref } = useMenu();
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="Sort saved listings" aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
        <MoreIcon className="h-6 w-6" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="flex items-center gap-2 px-4 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><SortIcon className="h-3.5 w-3.5" />Sort</p>
          {SORTS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => { onSort(value); setOpen(false); }}
              className={`${menuItem} ${sort === value ? "font-semibold text-brand dark:text-emerald-300" : ""}`}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SavedPage() {
  const me = useMe();
  const savedIds = useSavedIds();
  const ready = useSavedReady();
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const [text, setText] = useState("");
  const [searching, setSearching] = useState(false);
  const [kind, setKind] = useState<Kind>("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

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

  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => {
      try { if (current && localStorage.getItem(VIEW_KEY) === "list") setView("list"); } catch { /* storage blocked */ }
    });
    return () => { current = false; };
  }, []);
  function chooseView(v: "grid" | "list") {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  }

  // Unsaving takes a card away (a heart turned off here or anywhere else on the page).
  const kept = useMemo(() => (rows ?? []).filter(r => !ready || savedIds.has(r.listing.id)), [rows, savedIds, ready]);
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = kept.filter(r => (!kind || kindOf(r.listing) === kind) &&
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

  const count = (k: Kind) => k ? kept.filter(r => kindOf(r.listing) === k).length : kept.length;
  const kinds: [Kind, string, typeof HomeIcon][] = [["", "All saved", HeartIcon], ["apartment", "Apartments", BuildingIcon], ["room", "Rooms", BedIcon], ["house", "Houses", HomeIcon]];
  const subtitle = rows === null ? "Loading…" : `Your saved listings (${kept.length})`;
  const searchBox = (
    <label className="relative block">
      <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Search your saved listings" aria-label="Search your saved listings"
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 ps-9 pe-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-900" />
    </label>
  );

  return (
    <main className="mx-auto max-w-[96rem] px-4 pb-10 pt-5 sm:px-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:px-8 lg:pt-8">
      {/* Desktop: the kinds on the left (docs/mockups/saved-desktop.jpg). */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="px-2 text-xl font-bold text-gray-900 dark:text-white">Saved</h2>
          <ul className="mt-3 space-y-1">
            {kinds.map(([value, label, Icon]) => (
              <li key={label}>
                <button type="button" onClick={() => setKind(value)} aria-pressed={kind === value}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${kind === value ? "bg-brand-soft text-brand dark:bg-brand/25 dark:text-emerald-200" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}>
                  <Icon className="h-5 w-5" /><span className="flex-1 text-start">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${kind === value ? "bg-brand text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>{count(value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Phones: title with search and sort buttons (docs/mockups/saved-mobile.jpg). */}
        <div className="flex items-start justify-between gap-3 lg:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Saved</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
          <div className="flex items-center">
            <button type="button" onClick={() => { setSearching(s => !s); if (searching) setText(""); }} aria-label={searching ? "Close search" : "Search your saved listings"} aria-expanded={searching}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
              {searching ? <XIcon className="h-6 w-6" /> : <SearchIcon className="h-6 w-6" />}
            </button>
            <SortMenu sort={sort} onSort={setSort} />
          </div>
        </div>
        {searching && <div className="mt-3 lg:hidden">{searchBox}</div>}

        {/* Desktop: title, search, sort, grid or list. */}
        <div className="hidden items-end justify-between gap-4 lg:flex">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Saved listings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{rows === null ? "Loading…" : `${kept.length} saved listing${kept.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-72">{searchBox}</div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              Sort by
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort saved listings"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" role="group" aria-label="Show as">
              {([["grid", "Grid", GridIcon], ["list", "List", ListIcon]] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => chooseView(value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium ${view === value ? "bg-brand-soft text-brand dark:bg-brand/25 dark:text-emerald-200" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300"}`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:hidden" role="tablist" aria-label="Kind of place">
          {kinds.map(([value, label]) => (
            <button key={label} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${kind === value ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"}`}>
              {value ? label : "All"} ({count(value)})
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
            <p className="py-12 text-center text-sm text-gray-500">{text.trim() ? <>No saved listing matches &ldquo;{text}&rdquo;.</> : "None of your saved listings is of this kind."}</p>
          ) : (
            <>
              <div className={`space-y-3 ${view === "list" ? "" : "lg:hidden"}`}>
                {shown.map(r => (
                  <ListingCard key={r.listing.id} listing={r.listing} layout="row" footer={<SavedActions row={r} />} menu={<CardMenu listing={r.listing} />} />
                ))}
              </div>
              {view === "grid" && (
                <div className="hidden gap-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                  {shown.map(r => (
                    <ListingCard key={r.listing.id} listing={r.listing} layout="grid" photoCount ago={savedAgo(r.savedAt)} menu={<CardMenu listing={r.listing} />} />
                  ))}
                </div>
              )}
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
    <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5 sm:ms-auto sm:w-96 sm:px-3 sm:pb-3">
      {gone ? (
        <button type="button" onClick={() => toggleSaved(row.listing.id)}
          className="col-span-2 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Remove from Saved
        </button>
      ) : (
        <>
          <Link href={`/listings/${row.listing.id}`} className="flex items-center justify-center rounded-xl border-[1.5px] border-brand py-2 text-sm font-semibold text-brand dark:text-emerald-300">View details</Link>
          <Link href={`/listings/${row.listing.id}/messages`} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <MessageIcon className="h-4 w-4" />Message
          </Link>
        </>
      )}
    </div>
  );
}
