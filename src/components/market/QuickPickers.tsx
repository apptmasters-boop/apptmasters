"use client";
/**
 * Quick filter buttons with a small picker under the row (Sprint 13b/13c;
 * docs/mockups/home-mobile.jpg, search-results-mobile.jpg).
 *   Home:     Filters · Price ▾ · Bedrooms ▾ · Move-in date ▾ (choosing opens Find a Home)
 *   Results:  Filters · place · people · price · bedrooms, each showing the
 *             current choice, with "Any" to remove it
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { orderedPrices, type SearchFilters } from "@/lib/listingSearch";
import PriceRange from "./PriceRange";
import { BedIcon, CalendarIcon, ChevronDownIcon, PinIcon, SlidersIcon, TagIcon, UsersIcon, XIcon } from "@/components/landing/icons";

export type PickerKey = "place" | "people" | "price" | "bedrooms" | "moveIn";

const BEDROOMS: [string, string][] = [["0", "Studio"], ["1", "1"], ["2", "2"], ["3+", "3+"]];
const PEOPLE: [number, string][] = [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5+"]];

const chip = "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm dark:bg-gray-900";
const idle = "border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:text-gray-100";
const option = (on: boolean) => `rounded-xl border px-3 py-2.5 text-sm font-medium ${on
  ? "border-brand bg-brand-soft text-brand dark:bg-brand/25 dark:text-emerald-200"
  : "border-gray-200 text-gray-800 hover:border-brand hover:text-brand dark:border-gray-700 dark:text-gray-100"}`;
const clearButton = "mt-3 text-sm font-semibold text-gray-600 underline-offset-2 hover:underline dark:text-gray-300";
const field = "min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:text-white";
const goButton = "shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** The button text: the current choice on the results, the name of the filter otherwise. */
function chipText(key: PickerKey, f: SearchFilters, showValues: boolean): string {
  const names: Record<PickerKey, string> = { place: "Location", people: "People", price: "Price", bedrooms: "Bedrooms", moveIn: "Move-in date" };
  if (!showValues) return names[key];
  if (key === "place") return f.q || "Anywhere";
  if (key === "people") return f.occupants ? (f.occupants >= 5 ? "5+ people" : `${f.occupants} ${f.occupants === 1 ? "person" : "people"}`) : "People";
  if (key === "price") {
    if (f.minPrice !== null && f.maxPrice !== null) return `${money(f.minPrice)} – ${money(f.maxPrice)}`;
    if (f.maxPrice !== null) return `Up to ${money(f.maxPrice)}`;
    if (f.minPrice !== null) return `${money(f.minPrice)}+`;
    return "Any price";
  }
  if (key === "bedrooms") return f.bedrooms === "0" ? "Studio" : f.bedrooms ? `${f.bedrooms} bd` : "Any bedrooms";
  return f.moveIn
    ? `By ${new Date(`${f.moveIn}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : names.moveIn;
}

const isSet = (key: PickerKey, f: SearchFilters) =>
  key === "place" ? !!f.q : key === "people" ? !!f.occupants : key === "price" ? f.minPrice !== null || f.maxPrice !== null
    : key === "bedrooms" ? !!f.bedrooms : !!f.moveIn;

const CLEAR: Record<PickerKey, [string, Partial<SearchFilters>]> = {
  place: ["Anywhere", { q: "" }],
  people: ["Any number of people", { occupants: null }],
  price: ["Any price", { minPrice: null, maxPrice: null }],
  bedrooms: ["Any bedrooms", { bedrooms: "" }],
  moveIn: ["Any date", { moveIn: "" }],
};

export default function QuickPickers({ pickers, filters, onPick, filtersHref, onFilters, filtersCount = 0, showValues = false, className = "mt-3" }: {
  pickers: PickerKey[];
  filters: SearchFilters;
  onPick: (patch: Partial<SearchFilters>) => void;
  /** The Filters button opens this page, or calls onFilters. */
  filtersHref?: string;
  onFilters?: () => void;
  filtersCount?: number;
  showValues?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<PickerKey | null>(null);
  const [place, setPlace] = useState(filters.q);
  const [date, setDate] = useState(filters.moveIn);
  // The price range's draft until Show (fix F8: the same range as in Filters).
  const [price, setPrice] = useState({ min: filters.minPrice, max: filters.maxPrice });

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  function toggle(key: PickerKey) {
    setPlace(filters.q);
    setDate(filters.moveIn);
    setPrice({ min: filters.minPrice, max: filters.maxPrice });
    setOpen(o => (o === key ? null : key));
  }
  function pick(patch: Partial<SearchFilters>) {
    setOpen(null);
    onPick(patch);
  }

  const icons: Record<PickerKey, typeof TagIcon> = { place: PinIcon, people: UsersIcon, price: TagIcon, bedrooms: BedIcon, moveIn: CalendarIcon };
  const titles: Record<PickerKey, string> = {
    place: "City, neighborhood, or ZIP code", people: "How many people will live there?", price: "Price range per month",
    bedrooms: "Bedrooms", moveIn: "Move-in date",
  };
  const filtersInner = (
    <>
      <SlidersIcon className="h-4 w-4" />Filters
      {filtersCount > 0 && <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{filtersCount}</span>}
    </>
  );

  return (
    <div className={className}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {filtersHref
          ? <Link href={filtersHref} className={`${chip} ${idle}`}>{filtersInner}</Link>
          : <button type="button" onClick={() => { setOpen(null); onFilters?.(); }} className={`${chip} ${idle}`}>{filtersInner}</button>}
        {pickers.map(key => {
          const Icon = icons[key];
          const active = open === key;
          return (
            <button key={key} type="button" aria-expanded={active} aria-controls="quick-picker" onClick={() => toggle(key)}
              className={`${chip} ${active ? "border-brand text-brand ring-1 ring-brand dark:text-emerald-300" : idle}`}>
              <Icon className="h-4 w-4" />
              <span className="max-w-[10rem] truncate">{chipText(key, filters, showValues)}</span>
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform sm:h-4 sm:w-4 ${active ? "rotate-180" : ""}`} />
            </button>
          );
        })}
      </div>

      {open && (
        <div id="quick-picker" role="region" aria-label={titles[open]}
          className="mt-2 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-lg shadow-black/5 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-semibold text-gray-900 dark:text-white">{titles[open]}</p>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-1 rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {open === "place" && (
            <form onSubmit={e => { e.preventDefault(); pick({ q: place.trim() }); }} className="flex gap-2">
              <input value={place} onChange={e => setPlace(e.target.value)} placeholder="New York, Brooklyn, or 11226"
                aria-label="City, neighborhood, or ZIP code" className={field} />
              <button type="submit" className={goButton}>Show</button>
            </form>
          )}

          {open === "people" && (
            <div className="grid grid-cols-5 gap-2">
              {PEOPLE.map(([n, label]) => (
                <button key={n} type="button" onClick={() => pick({ occupants: n })} className={option(filters.occupants === n)}>{label}</button>
              ))}
            </div>
          )}

          {open === "price" && (
            <form onSubmit={e => { e.preventDefault(); pick(orderedPrices(price.min, price.max)); }}>
              <PriceRange min={price.min} max={price.max} onChange={(min, max) => setPrice({ min, max })} />
              <button type="submit" className={`${goButton} mt-4 w-full`}>Show</button>
            </form>
          )}

          {open === "bedrooms" && (
            <div className="grid grid-cols-4 gap-2">
              {BEDROOMS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => pick({ bedrooms: value })} className={option(filters.bedrooms === value)}>{label}</button>
              ))}
            </div>
          )}

          {open === "moveIn" && (
            <form onSubmit={e => { e.preventDefault(); if (date) pick({ moveIn: date }); }} className="flex gap-2">
              <label className="sr-only" htmlFor="quick-move-in">Move-in date</label>
              <input id="quick-move-in" type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)} className={field} />
              <button type="submit" disabled={!date} className={goButton}>Show listings</button>
            </form>
          )}

          {isSet(open, filters) && (
            <button type="button" className={clearButton} onClick={() => pick(CLEAR[open][1])}>{CLEAR[open][0]}</button>
          )}
        </div>
      )}
    </div>
  );
}
