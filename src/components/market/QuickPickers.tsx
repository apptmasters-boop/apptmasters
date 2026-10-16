"use client";
/**
 * The quick buttons under the Home search (Sprint 13b; docs/mockups/home-mobile.jpg):
 * Filters · Price ▾ · Bedrooms ▾ · Move-in date ▾. Price, Bedrooms and Move-in
 * date open a small picker right under the row; choosing opens Find a Home
 * with that filter and with whatever is typed in the search box.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPTY_FILTERS, filtersToParams, type SearchFilters } from "@/lib/listingSearch";
import { BedIcon, CalendarIcon, ChevronDownIcon, SlidersIcon, TagIcon, XIcon } from "@/components/landing/icons";

type Picker = "price" | "bedrooms" | "moveIn";

const PRICES = [1000, 1500, 2000, 2500, 3000, 4000];
const BEDROOMS: [string, string][] = [["0", "Studio"], ["1", "1"], ["2", "2"], ["3+", "3+"]];

const chip = "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm dark:bg-gray-900";
const option = "rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 hover:border-brand hover:text-brand dark:border-gray-700 dark:text-gray-100";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function QuickPickers({ q }: { q: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<Picker | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  function show(patch: Partial<SearchFilters>) {
    const query = filtersToParams({ ...EMPTY_FILTERS, q: q.trim(), ...patch }).toString();
    router.push(query ? `/listings?${query}` : "/listings");
  }

  const pickers: { key: Picker; label: string; icon: typeof TagIcon }[] = [
    { key: "price", label: "Price", icon: TagIcon },
    { key: "bedrooms", label: "Bedrooms", icon: BedIcon },
    { key: "moveIn", label: "Move-in date", icon: CalendarIcon },
  ];
  const titles: Record<Picker, string> = { price: "Rent per month, up to", bedrooms: "Bedrooms", moveIn: "Move-in date" };

  return (
    <div className="mt-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Link href={q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}&panel=1` : "/listings?panel=1"}
          className={`${chip} border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:text-gray-100`}>
          <SlidersIcon className="h-4 w-4" />Filters
        </Link>
        {pickers.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" aria-expanded={open === key} aria-controls="quick-picker"
            onClick={() => setOpen(o => (o === key ? null : key))}
            className={`${chip} ${open === key ? "border-brand text-brand ring-1 ring-brand dark:text-emerald-300" : "border-gray-200 text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:text-gray-100"}`}>
            <Icon className="h-4 w-4" />{label}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform sm:h-4 sm:w-4 ${open === key ? "rotate-180" : ""}`} />
          </button>
        ))}
      </div>

      {open && (
        <div id="quick-picker" role="region" aria-label={titles[open]}
          className="mt-2 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-lg shadow-black/5 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-white">{titles[open]}</p>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-1 rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {open === "price" && (
            <div className="grid grid-cols-3 gap-2">
              {PRICES.map(p => (
                <button key={p} type="button" onClick={() => show({ maxPrice: p })} className={option}>
                  ${p.toLocaleString("en-US")}
                </button>
              ))}
            </div>
          )}

          {open === "bedrooms" && (
            <div className="grid grid-cols-4 gap-2">
              {BEDROOMS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => show({ bedrooms: value })} className={option}>{label}</button>
              ))}
            </div>
          )}

          {open === "moveIn" && (
            <form onSubmit={e => { e.preventDefault(); if (date) show({ moveIn: date }); }} className="flex gap-2">
              <label className="sr-only" htmlFor="quick-move-in">Move-in date</label>
              <input id="quick-move-in" type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:text-white" />
              <button type="submit" disabled={!date}
                className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                Show listings
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
