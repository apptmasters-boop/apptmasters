"use client";
/**
 * Find a Home (Sprint 12, look matched to the pictures in Sprint 13c;
 * MARKETPLACE_FLOW.md §3–§7; designs docs/mockups/search-results-mobile.jpg,
 * filters-mobile.jpg, find-a-home-desktop.jpg). Public: anyone can search. The
 * filters live in the page address, so they survive signing in and the Back
 * button (§12); every active filter can be seen and removed (§6); no matches
 * means an honest empty state, never other listings passed off as matches (§7).
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { parseFilters, filtersToParams, activeChips, SORTS, KINDS, EMPTY_FILTERS, type SearchFilters, type SortOrder } from "@/lib/listingSearch";
import FilterPanel from "@/components/market/FilterPanel";
import QuickPickers from "@/components/market/QuickPickers";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import { ArrowLeftIcon, GridIcon, ListIcon, SearchIcon, SortIcon, XIcon } from "@/components/landing/icons";

interface Results {
  listings: MarketListing[];
  total: number;
  counts: { all: number; apartment: number; room: number; house: number };
  page: number;
  pageSize: number;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
/** The quick buttons already show these (with "Any" to remove them). The place has no button
 * (owner, fix F3: "Anywhere" was redundant), so a searched place shows as a removable chip. */
const ON_QUICK_BUTTONS = new Set(["occupants", "price", "bedrooms", "moveIn"]);
/** The tabs show this one. */
const ON_TABS = new Set(["kind"]);
const VIEW_KEY = "am:resultsView";

function FindAHome() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(query)), [query]);
  const [results, setResults] = useState<Results | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Home's Filters button opens the Filters screen on phones.
  const [sheet, setSheet] = useState(() => params.get("panel") === "1");
  // Desktop: grid of cards or a list (remembered on this device).
  const [view, setView] = useState<"grid" | "list">("grid");

  // Remember this search, so "Back to results" and Home's "Based on your last search" return to it (§12).
  useEffect(() => {
    try { sessionStorage.setItem("am:lastSearch", query ? `?${query}` : ""); } catch { /* storage blocked */ }
  }, [query]);

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

  const chips = activeChips(filters).filter(c => !ON_TABS.has(c.key));
  const otherChips = chips.filter(c => !ON_QUICK_BUTTONS.has(c.key));
  const price = filters.minPrice !== null && filters.maxPrice !== null ? `${money(filters.minPrice)} – ${money(filters.maxPrice)}`
    : filters.maxPrice !== null ? `Up to ${money(filters.maxPrice)}` : filters.minPrice !== null ? `${money(filters.minPrice)}+` : null;
  const summary = [
    results ? `${results.total} listing${results.total === 1 ? "" : "s"}` : null,
    filters.occupants ? `${filters.occupants} ${filters.occupants === 1 ? "person" : "people"}` : null,
    price,
  ].filter(Boolean).join(" · ");
  const where = filters.q || "All areas";
  const tabs: { value: SearchFilters["kind"]; label: string; count?: number }[] = [
    { value: "", label: "All", count: results?.counts.all },
    ...KINDS.map(k => ({ value: k.value, label: k.label, count: results?.counts[k.value] })),
  ];
  const clearAll = () => go({ ...EMPTY_FILTERS, sort: filters.sort });

  const removable = (list: typeof chips, className: string) => list.length > 0 && (
    <div className={`mt-3 flex-wrap items-center gap-2 ${className}`} aria-label="Active filters">
      {list.map(c => (
        <button key={c.key} type="button" onClick={() => go({ ...filters, ...c.clear }, true)} aria-label={`Remove ${c.label}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/15 dark:bg-brand/25 dark:text-emerald-200">
          {c.label}<XIcon className="h-3.5 w-3.5" />
        </button>
      ))}
      <button type="button" onClick={clearAll} className="px-1 text-sm font-semibold text-gray-600 underline-offset-2 hover:underline dark:text-gray-300">
        Clear all
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-[96rem] px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-8">
      <div className="min-w-0">
        {/* Phones: where, how many, people and price, sort; then the quick buttons. */}
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
        {/* Desktop: the count, sort, and grid or list. */}
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {results ? `${results.total} ${results.total === 1 ? "place" : "places"}` : "Places"} in {where}
          </h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              Sort by
              <select value={filters.sort} onChange={e => go({ ...filters, sort: e.target.value as SortOrder }, true)} aria-label="Sort by"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" role="group" aria-label="Show as">
              {([["grid", "Grid", GridIcon], ["list", "List", ListIcon]] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => chooseView(value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium ${view === value ? "bg-brand-soft text-brand dark:bg-brand/25 dark:text-emerald-200" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300"}`}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The filters, on top on every screen (Fix F1): Filters opens all of them; the others open a picker. */}
        <QuickPickers key={query} className="mt-4" pickers={["people", "price", "bedrooms", "moveIn"]} filters={filters} showValues
          onPick={patch => go({ ...filters, ...patch }, true)} onFilters={() => setSheet(true)} filtersCount={chips.length} />

        {/* Apartments, rooms or houses, with how many of each match. */}
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Kind of place">
          {tabs.map(t => (
            <button key={t.label} type="button" role="tab" aria-selected={filters.kind === t.value && !filters.type}
              onClick={() => go({ ...filters, kind: t.value, type: "", roomType: t.value === "room" ? filters.roomType : "" }, true)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5 sm:py-2.5 ${
                filters.kind === t.value && !filters.type ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"}`}>
              {t.label}{t.count !== undefined && ` (${t.count})`}
            </button>
          ))}
        </div>

        {/* Every active filter can be removed (§6): those not on the quick buttons, as chips. */}
        {removable(otherChips, "flex")}

        <div className="mt-5">
          {failed ? (
            <p className="py-16 text-center text-sm text-gray-500">Couldn&apos;t load listings. Please refresh.</p>
          ) : !results ? (
            <div className="grid gap-3 lg:grid-cols-3 lg:gap-5 2xl:grid-cols-4">
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
                {(chips.length > 0 || filters.kind) && (
                  <button type="button" onClick={clearAll} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Clear all filters</button>
                )}
                <button type="button" onClick={() => setSheet(true)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">Change filters</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {results.listings.map(l => <ListingCard key={l.id} listing={l} layout="row" />)}
              </div>
              {view === "grid" ? (
                <div className="hidden gap-5 lg:grid lg:grid-cols-3 2xl:grid-cols-4">
                  {results.listings.map(l => <ListingCard key={l.id} listing={l} layout="grid" />)}
                </div>
              ) : (
                <div className="hidden space-y-3 lg:block">
                  {results.listings.map(l => <ListingCard key={l.id} listing={l} layout="row" />)}
                </div>
              )}
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

      {/* All the filters: a sheet on phones (docs/mockups/filters-mobile.jpg), a window on computers (Fix F1). */}
      {sheet && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 top-4 flex flex-col rounded-t-3xl bg-white px-4 pt-2.5 shadow-2xl motion-safe:animate-[sheet-up_0.25s_ease-out] sm:inset-x-auto sm:bottom-6 sm:right-1/2 sm:top-6 sm:w-[34rem] sm:translate-x-1/2 sm:rounded-3xl sm:px-6 sm:pt-5 sm:motion-safe:animate-none dark:bg-gray-900">
            <span className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden dark:bg-gray-700" aria-hidden />
            <FilterPanel value={filters} onClose={() => setSheet(false)} onApply={f => { setSheet(false); go(f); }} />
          </div>
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
