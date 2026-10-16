"use client";
/**
 * Find a Home (Sprint 12; MARKETPLACE_FLOW.md §3–§7; designs
 * docs/mockups/search-results-mobile.jpg, filters-mobile.jpg,
 * find-a-home-desktop.jpg). Public: anyone can search. The filters live in the
 * page address, so they survive signing in and the Back button (§12); every
 * active filter is a removable chip (§6); no matches means an honest empty
 * state, never other listings passed off as matches (§7).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { parseFilters, filtersToParams, activeChips, SORTS, EMPTY_FILTERS, type SearchFilters, type SortOrder } from "@/lib/listingSearch";
import FilterPanel from "@/components/market/FilterPanel";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import HomeQuestionCard from "./_components/HomeQuestionCard";
import { ArrowLeftIcon, SearchIcon, SlidersIcon, SortIcon, UsersIcon, TagIcon, PinIcon, BedIcon, XIcon } from "@/components/landing/icons";


interface Results { listings: MarketListing[]; total: number; counts: { all: number; APARTMENT_FOR_RENT: number; ROOM_TO_SHARE: number }; page: number; pageSize: number }

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function FindAHome() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(query)), [query]);
  const [results, setResults] = useState<Results | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Home's quick chips (Filters, Price, People, Move-in date) open the Filters screen on phones.
  const [sheet, setSheet] = useState(() => params.get("panel") === "1");

  // Remember this search, so "Back to results" from a listing returns to it (§12).
  useEffect(() => {
    try { sessionStorage.setItem("am:lastSearch", query ? `?${query}` : ""); } catch { /* storage blocked */ }
  }, [query]);

  useEffect(() => {
    let current = true;
    async function load() {
      const res = await fetch(`/api/listings/search?${filtersToParams(filters).toString()}`).catch(() => null);
      if (!current) return;
      if (!res?.ok) { setFailed(true); return; }
      const data: Results = await res.json();
      if (current) { setFailed(false); setResults(data); }
    }
    load();
    return () => { current = false; };
  }, [filters]);

  function go(next: SearchFilters, replace = false) {
    const q = filtersToParams(next).toString();
    const url = q ? `/listings?${q}` : "/listings";
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }

  async function more() {
    if (!results) return;
    setLoadingMore(true);
    const res = await fetch(`/api/listings/search?${filtersToParams(filters).toString()}&page=${results.page + 1}`).catch(() => null);
    if (res?.ok) {
      const next: Results = await res.json();
      setResults(r => r ? { ...next, listings: [...r.listings, ...next.listings] } : next);
    }
    setLoadingMore(false);
  }

  const chips = activeChips(filters).filter(c => c.key !== "type");
  const summary = [
    results ? `${results.total} listing${results.total === 1 ? "" : "s"}` : null,
    filters.occupants ? `${filters.occupants} ${filters.occupants === 1 ? "person" : "people"}` : null,
    filters.minPrice !== null || filters.maxPrice !== null ? `${filters.minPrice !== null ? money(filters.minPrice) : "$0"} – ${filters.maxPrice !== null ? money(filters.maxPrice) : "any"}` : null,
  ].filter(Boolean).join(" · ");
  const where = filters.q || "All areas";
  const tabs: { value: SearchFilters["type"]; label: string; count?: number }[] = [
    { value: "", label: "All", count: results?.counts.all },
    { value: "APARTMENT_FOR_RENT", label: "Whole places", count: results?.counts.APARTMENT_FOR_RENT },
    { value: "ROOM_TO_SHARE", label: "Rooms", count: results?.counts.ROOM_TO_SHARE },
  ];
  const quick = [
    { icon: PinIcon, label: filters.q || "Location" },
    { icon: UsersIcon, label: filters.occupants ? `${filters.occupants} ${filters.occupants === 1 ? "person" : "people"}` : "People" },
    { icon: TagIcon, label: filters.maxPrice !== null ? `Under ${money(filters.maxPrice)}` : "Price" },
    { icon: BedIcon, label: filters.bedrooms ? (filters.bedrooms === "0" ? "Studio" : `${filters.bedrooms} bd`) : "Any bedrooms" },
  ];

  const sortSelect = (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="hidden sm:inline">Sort by</span>
      <select value={filters.sort} onChange={e => go({ ...filters, sort: e.target.value as SortOrder }, true)} aria-label="Sort by"
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </label>
  );

  return (
    <main className="mx-auto max-w-[96rem] px-4 pb-10 pt-4 sm:px-6 lg:grid lg:grid-cols-[19rem_1fr] lg:gap-8 lg:px-8 lg:pt-8">
      {/* Desktop: the filters on the left (§4). */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <FilterPanel key={query} value={filters} onApply={f => go(f)} />
        </div>
      </aside>

      <div className="min-w-0">
        <HomeQuestionCard />

        {/* Phones: where, how many, the price, sort; then quick chips that open the filters. */}
        <div className="flex items-center gap-3 lg:hidden">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-1 rounded-full p-1 text-gray-800 dark:text-gray-200"><ArrowLeftIcon className="h-6 w-6" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-gray-900 dark:text-white">{where}</h1>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{summary || "Searching…"}</p>
          </div>
          <label className="relative rounded-full p-2 text-gray-800 dark:text-gray-200" aria-label="Sort">
            <SortIcon className="h-6 w-6" />
            <select value={filters.sort} onChange={e => go({ ...filters, sort: e.target.value as SortOrder }, true)} aria-label="Sort by" className="absolute inset-0 cursor-pointer opacity-0">
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          <button type="button" onClick={() => setSheet(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <SlidersIcon className="h-4 w-4" />Filters{chips.length > 0 && <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{chips.length}</span>}
          </button>
          {quick.map(({ icon: Icon, label }) => (
            <button key={label} type="button" onClick={() => setSheet(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* Desktop: the count and the sort. */}
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {results ? `${results.total} ${results.total === 1 ? "place" : "places"}` : "Places"} in {where}
          </h1>
          {sortSelect}
        </div>

        {/* Whole places or rooms, with how many of each match. */}
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Kind of place">
          {tabs.map(t => (
            <button key={t.label} type="button" role="tab" aria-selected={filters.type === t.value}
              onClick={() => go({ ...filters, type: t.value, roomType: t.value === "ROOM_TO_SHARE" ? filters.roomType : "" }, true)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                filters.type === t.value ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"}`}>
              {t.label}{t.count !== undefined && ` (${t.count})`}
            </button>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map(c => (
              <button key={c.key} type="button" onClick={() => go({ ...filters, ...c.clear }, true)} aria-label={`Remove ${c.label}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/15 dark:bg-brand/25 dark:text-emerald-200">
                {c.label}<XIcon className="h-3.5 w-3.5" />
              </button>
            ))}
            <button type="button" onClick={() => go({ ...EMPTY_FILTERS, sort: filters.sort })} className="px-1 text-sm font-semibold text-gray-600 underline-offset-2 hover:underline dark:text-gray-300">
              Clear all
            </button>
          </div>
        )}

        <div className="mt-5">
          {failed ? (
            <p className="py-16 text-center text-sm text-gray-500">Couldn&apos;t load listings. Please refresh.</p>
          ) : !results ? (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 lg:gap-5">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100 lg:h-80 dark:bg-gray-800" />)}
            </div>
          ) : results.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900">
              <SearchIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-900 dark:text-white">No listings match these filters</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                Try removing a filter{chips.length > 0 ? " above" : ""}, or widen the price or the place. We only show places that match.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {chips.length > 0 && (
                  <button type="button" onClick={() => go({ ...EMPTY_FILTERS, sort: filters.sort })} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Clear all filters</button>
                )}
                <button type="button" onClick={() => setSheet(true)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 lg:hidden dark:border-gray-700 dark:text-gray-100">Change filters</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {results.listings.map(l => <ListingCard key={l.id} listing={l} layout="row" />)}
              </div>
              <div className="hidden gap-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                {results.listings.map(l => <ListingCard key={l.id} listing={l} layout="grid" />)}
              </div>
              {results.listings.length < results.total && (
                <div className="mt-6 text-center">
                  <button type="button" onClick={more} disabled={loadingMore}
                    className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    {loadingMore ? "Loading…" : `Show more (${results.total - results.listings.length} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Have a place to rent or a room to share? <Link href="/listings/new" className="font-semibold text-brand hover:underline dark:text-emerald-300">Post a listing</Link>
        </p>
      </div>

      {/* Phones: the Filters screen. */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white px-4 pt-4 lg:hidden dark:bg-gray-900" role="dialog" aria-modal="true" aria-label="Filters">
          <FilterPanel value={filters} sticky onClose={() => setSheet(false)} onApply={f => { setSheet(false); go(f); }} />
        </div>
      )}
    </main>
  );
}

export default function FindAHomePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}>
      <FindAHome />
    </Suspense>
  );
}
