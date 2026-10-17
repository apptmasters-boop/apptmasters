"use client";
/**
 * The search on the signed-out Home (fix F7, owner's choice 2026-10-17): All ·
 * Rooms · Whole places, then one Location box. Like the big rental sites, the
 * other filters (people, price, bedrooms, move-in date) are on the results'
 * top row.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinIcon, SearchIcon } from "./icons";
import { HOME_KINDS, searchToQuery, type ListingSearch } from "./options";

export default function SearchPanel() {
  const router = useRouter();
  const [s, setS] = useState<ListingSearch>({ city: "", kind: "" });

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchToQuery(s);
    router.push(q ? `/listings?${q}` : "/listings");
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-black/5 md:p-4">
      <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Looking for">
        {HOME_KINDS.map(k => (
          <button key={k.label} type="button" role="radio" aria-checked={s.kind === k.value}
            onClick={() => setS(prev => ({ ...prev, kind: k.value }))}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              s.kind === k.value ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <span className="text-gray-500"><PinIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <label htmlFor="lp-city" className="block text-[11px] text-gray-500">Location</label>
            <input id="lp-city" value={s.city} onChange={e => setS(prev => ({ ...prev, city: e.target.value }))} enterKeyHint="search"
              placeholder="Enter a city, neighborhood or ZIP code" autoComplete="address-level2"
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none" />
          </div>
        </div>
        <button type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:rounded-full">
          <SearchIcon className="h-4 w-4" />
          Search
        </button>
      </div>
    </form>
  );
}
