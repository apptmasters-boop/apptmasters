"use client";
/**
 * The search on the signed-out Home (owner's choices 2026-10-17, fixes F7 and
 * F10): one Location box and Search. Like the big rental sites, every filter
 * (kind of place, people, price, bedrooms, move-in date…) is on the results
 * page.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinIcon, SearchIcon } from "./icons";
import { searchToQuery } from "./options";

export default function SearchPanel() {
  const router = useRouter();
  const [city, setCity] = useState("");

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchToQuery({ city });
    router.push(q ? `/listings?${q}` : "/listings");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-black/5 sm:flex-row md:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        <span className="text-gray-500"><PinIcon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <label htmlFor="lp-city" className="block text-[11px] text-gray-500">Location</label>
          <input id="lp-city" value={city} onChange={e => setCity(e.target.value)} enterKeyHint="search"
            placeholder="Enter a city, neighborhood or ZIP code" autoComplete="address-level2"
            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none" />
        </div>
      </div>
      <button type="submit"
        className="flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:rounded-full">
        <SearchIcon className="h-4 w-4" />
        Search
      </button>
    </form>
  );
}
