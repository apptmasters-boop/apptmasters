"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PinIcon, HomeIcon, DollarIcon, SearchIcon, UsersIcon } from "./icons";
import { TYPE_OPTIONS, BUDGET_OPTIONS, OCCUPANT_OPTIONS, searchToQuery, type ListingSearch } from "./options";

function Field({ icon, label, htmlFor, className = "", children }: {
  icon: ReactNode; label: string; htmlFor: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 ${className}`}>
      <span className="text-gray-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-[11px] text-gray-500">{label}</label>
        {children}
      </div>
    </div>
  );
}

const inputClass = "w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none";

export default function SearchPanel() {
  const router = useRouter();
  const [s, setS] = useState<ListingSearch>({ city: "", type: "", maxPrice: "", occupants: "" });
  const set = (patch: Partial<ListingSearch>) => setS(prev => ({ ...prev, ...patch }));

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchToQuery(s);
    router.push(q ? `/listings?${q}` : "/listings");
  }

  return (
    <div>
      <form onSubmit={submit}
        className="grid gap-2.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-black/5 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:p-4">
        <Field icon={<PinIcon className="h-5 w-5" />} label="Location" htmlFor="lp-city" className="sm:col-span-2 md:col-span-1">
          <input id="lp-city" value={s.city} onChange={e => set({ city: e.target.value })}
            placeholder="Enter a city, neighborhood or ZIP code" className={inputClass} autoComplete="address-level2" />
        </Field>
        <Field icon={<HomeIcon className="h-5 w-5" />} label="Looking for" htmlFor="lp-type">
          <select id="lp-type" value={s.type}
            onChange={e => set({ type: e.target.value })}
            className={`${inputClass} cursor-pointer`}>
            <option value="">Any place</option>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field icon={<UsersIcon className="h-5 w-5" />} label="People" htmlFor="lp-people">
          <select id="lp-people" value={s.occupants} onChange={e => set({ occupants: e.target.value })} className={`${inputClass} cursor-pointer`}>
            {OCCUPANT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field icon={<DollarIcon className="h-5 w-5" />} label="Monthly budget" htmlFor="lp-budget">
          <select id="lp-budget" value={s.maxPrice} onChange={e => set({ maxPrice: e.target.value })} className={`${inputClass} cursor-pointer`}>
            {BUDGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <button type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:col-span-2 md:col-span-1 md:rounded-full">
          <SearchIcon className="h-4 w-4" />
          Search
        </button>
      </form>

    </div>
  );
}
