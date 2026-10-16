"use client";
/**
 * Every Find a Home filter (Sprint 12; MARKETPLACE_FLOW.md §4; designs
 * docs/mockups/filters-mobile.jpg and find-a-home-desktop.jpg). The same panel
 * is the side panel on desktop and the Filters screen on phones. It edits a
 * draft; "Show N listings" applies it, with N counted as you choose.
 * Radius comes with the map (Sprint 12f).
 */
import { useEffect, useState } from "react";
import { EMPTY_FILTERS, filtersToParams, LEASE_FILTERS, LISTED_WITHIN, type SearchFilters } from "@/lib/listingSearch";
import { AMENITIES, PROPERTY_TYPES, ROOM_TYPES, type AmenityKey } from "@/lib/listingFields";
import {
  AccessibleIcon, BathIcon, BedIcon, BoltIcon, BuildingIcon, CalendarIcon, CarIcon, ElevatorIcon, HomeIcon, NoSmokeIcon,
  PawIcon, PinIcon, ReceiptIcon, SearchIcon, ShowerIcon, SlidersIcon, SofaIcon, TagIcon, UsersIcon, WasherIcon, WifiIcon, XIcon,
} from "@/components/landing/icons";

const AMENITY_ICONS: Record<AmenityKey, (p: { className?: string }) => React.ReactNode> = {
  furnished: SofaIcon, internetIncluded: WifiIcon, utilitiesIncluded: BoltIcon, privateBathroom: ShowerIcon,
  parking: CarIcon, elevator: ElevatorIcon, petsAllowed: PawIcon, accessible: AccessibleIcon,
};

export function Pill({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"} ${className}`}>
      {children}
    </button>
  );
}

function Section({ icon, title, hint, onClear, children }: {
  icon: React.ReactNode; title: string; hint?: string; onClear?: () => void; children: React.ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 py-5 last:border-0 dark:border-gray-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-gray-700 dark:text-gray-300">{icon}</span>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
            {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
          </div>
        </div>
        {onClear && <button type="button" onClick={onClear} className="text-sm font-medium text-brand hover:underline dark:text-emerald-300">Clear</button>}
      </div>
      {children}
    </section>
  );
}

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white";

/** How many listings the draft would show (asked a moment after the last change). */
function useDraftCount(draft: SearchFilters) {
  const [count, setCount] = useState<number | null>(null);
  const query = filtersToParams(draft).toString();
  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/listings/search?${query}`).catch(() => null);
      if (res?.ok && current) setCount((await res.json()).total);
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  return count;
}

export default function FilterPanel({ value, onApply, onClose, sticky = false }: {
  value: SearchFilters; onApply: (f: SearchFilters) => void; onClose?: () => void; sticky?: boolean;
}) {
  const [draft, setDraft] = useState<SearchFilters>(value);
  const set = (patch: Partial<SearchFilters>) => setDraft(d => ({ ...d, ...patch }));
  const count = useDraftCount(draft);
  const toggleAmenity = (key: AmenityKey) =>
    set({ amenities: draft.amenities.includes(key) ? draft.amenities.filter(a => a !== key) : [...draft.amenities, key] });
  const money = (v: string) => { const n = Number(v); return v === "" || !Number.isFinite(n) || n < 0 ? null : n; };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close filters" className="-ml-1 rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-200">
            <XIcon className="h-6 w-6" />
          </button>
        ) : <span className="w-8" />}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
        <button type="button" onClick={() => setDraft({ ...EMPTY_FILTERS, sort: draft.sort })} className="text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
          Reset all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section icon={<PinIcon className="h-5 w-5" />} title="Location" hint="City, neighborhood, or ZIP code" onClear={draft.q ? () => set({ q: "" }) : undefined}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input aria-label="Location" value={draft.q} onChange={e => set({ q: e.target.value })} placeholder="New York, Brooklyn, or 11226" className={`${inputClass} pl-10`} />
          </div>
        </Section>

        <Section icon={<HomeIcon className="h-5 w-5" />} title="Looking for" onClear={draft.type || draft.roomType ? () => set({ type: "", roomType: "" }) : undefined}>
          <div className="flex flex-wrap gap-2">
            <Pill active={!draft.type} onClick={() => set({ type: "", roomType: "" })}>All</Pill>
            <Pill active={draft.type === "APARTMENT_FOR_RENT"} onClick={() => set({ type: "APARTMENT_FOR_RENT", roomType: "" })}>Whole place</Pill>
            <Pill active={draft.type === "ROOM_TO_SHARE"} onClick={() => set({ type: "ROOM_TO_SHARE" })}>Room</Pill>
          </div>
          {draft.type === "ROOM_TO_SHARE" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill active={!draft.roomType} onClick={() => set({ roomType: "" })}>Any room</Pill>
              {ROOM_TYPES.map(r => <Pill key={r.value} active={draft.roomType === r.value} onClick={() => set({ roomType: r.value })}>{r.label}</Pill>)}
            </div>
          )}
        </Section>

        <Section icon={<BuildingIcon className="h-5 w-5" />} title="Property type" onClear={draft.propertyType ? () => set({ propertyType: "" }) : undefined}>
          <div className="flex flex-wrap gap-2">
            <Pill active={!draft.propertyType} onClick={() => set({ propertyType: "" })}>All</Pill>
            {PROPERTY_TYPES.map(t => <Pill key={t.value} active={draft.propertyType === t.value} onClick={() => set({ propertyType: t.value })}>{t.label}</Pill>)}
          </div>
        </Section>

        <Section icon={<TagIcon className="h-5 w-5" />} title="Price range" hint="Per month" onClear={draft.minPrice !== null || draft.maxPrice !== null ? () => set({ minPrice: null, maxPrice: null }) : undefined}>
          <div className="grid grid-cols-2 gap-2">
            <label className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input inputMode="numeric" aria-label="Minimum price" value={draft.minPrice ?? ""} onChange={e => set({ minPrice: money(e.target.value) })} placeholder="Min" className={`${inputClass} pl-7`} />
            </label>
            <label className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input inputMode="numeric" aria-label="Maximum price" value={draft.maxPrice ?? ""} onChange={e => set({ maxPrice: money(e.target.value) })} placeholder="Max" className={`${inputClass} pl-7`} />
            </label>
          </div>
        </Section>

        <Section icon={<UsersIcon className="h-5 w-5" />} title="Number of occupants" hint="How many people will live there, you included?" onClear={draft.occupants ? () => set({ occupants: null }) : undefined}>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(n => <Pill key={n} active={draft.occupants === n} onClick={() => set({ occupants: draft.occupants === n ? null : n })}>{n === 5 ? "5+" : n}</Pill>)}
          </div>
        </Section>

        <Section icon={<BedIcon className="h-5 w-5" />} title="Bedrooms" onClear={draft.bedrooms ? () => set({ bedrooms: "" }) : undefined}>
          <div className="grid grid-cols-5 gap-2">
            {[["", "Any"], ["0", "Studio"], ["1", "1"], ["2", "2"], ["3+", "3+"]].map(([v, label]) =>
              <Pill key={v} active={draft.bedrooms === v} onClick={() => set({ bedrooms: v })}>{label}</Pill>)}
          </div>
        </Section>

        <Section icon={<BathIcon className="h-5 w-5" />} title="Bathrooms" onClear={draft.bathrooms ? () => set({ bathrooms: null }) : undefined}>
          <div className="grid grid-cols-4 gap-2">
            {[[null, "Any"], [1, "1+"], [2, "2+"], [3, "3+"]].map(([v, label]) =>
              <Pill key={String(label)} active={draft.bathrooms === v} onClick={() => set({ bathrooms: v as number | null })}>{label}</Pill>)}
          </div>
        </Section>

        <Section icon={<CalendarIcon className="h-5 w-5" />} title="Move-in date" hint="Available by then" onClear={draft.moveIn ? () => set({ moveIn: "" }) : undefined}>
          <input type="date" aria-label="Move-in date" value={draft.moveIn} onChange={e => set({ moveIn: e.target.value })} className={inputClass} />
        </Section>

        <Section icon={<ReceiptIcon className="h-5 w-5" />} title="Lease duration" onClear={draft.lease ? () => set({ lease: "" }) : undefined}>
          <div className="grid grid-cols-2 gap-2">
            <Pill active={!draft.lease} onClick={() => set({ lease: "" })}>Any</Pill>
            {LEASE_FILTERS.map(l => <Pill key={l.value} active={draft.lease === l.value} onClick={() => set({ lease: l.value })}>{l.label}</Pill>)}
          </div>
        </Section>

        <Section icon={<SlidersIcon className="h-5 w-5" />} title="Additional options"
          onClear={draft.amenities.length || draft.laundry ? () => set({ amenities: [], laundry: false }) : undefined}>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map(a => {
              const Icon = AMENITY_ICONS[a.key];
              return <Pill key={a.key} active={draft.amenities.includes(a.key)} onClick={() => toggleAmenity(a.key)}><Icon className="h-4 w-4" />{a.label}</Pill>;
            })}
            <Pill active={draft.laundry} onClick={() => set({ laundry: !draft.laundry })}><WasherIcon className="h-4 w-4" />Laundry</Pill>
          </div>
        </Section>

        <Section icon={<NoSmokeIcon className="h-5 w-5" />} title="Smoking" onClear={draft.smoking ? () => set({ smoking: "" }) : undefined}>
          <div className="grid grid-cols-3 gap-2">
            <Pill active={!draft.smoking} onClick={() => set({ smoking: "" })}>Any</Pill>
            <Pill active={draft.smoking === "free"} onClick={() => set({ smoking: "free" })}>Smoke-free</Pill>
            <Pill active={draft.smoking === "allowed"} onClick={() => set({ smoking: "allowed" })}>Allowed</Pill>
          </div>
        </Section>

        <Section icon={<TagIcon className="h-5 w-5" />} title="Fees" onClear={draft.noBrokerFee || draft.noApplicationFee ? () => set({ noBrokerFee: false, noApplicationFee: false }) : undefined}>
          <div className="flex flex-wrap gap-2">
            <Pill active={draft.noBrokerFee} onClick={() => set({ noBrokerFee: !draft.noBrokerFee })}>No broker fee</Pill>
            <Pill active={draft.noApplicationFee} onClick={() => set({ noApplicationFee: !draft.noApplicationFee })}>No application fee</Pill>
          </div>
        </Section>

        <Section icon={<CalendarIcon className="h-5 w-5" />} title="Listed" onClear={draft.listedWithin ? () => set({ listedWithin: null }) : undefined}>
          <div className="grid grid-cols-2 gap-2">
            <Pill active={!draft.listedWithin} onClick={() => set({ listedWithin: null })}>Any time</Pill>
            {LISTED_WITHIN.map(l => <Pill key={l.value} active={draft.listedWithin === l.value} onClick={() => set({ listedWithin: l.value })}>{l.label}</Pill>)}
          </div>
        </Section>
      </div>

      <div className={`border-t border-gray-100 pt-4 dark:border-gray-800 ${sticky ? "sticky bottom-0 bg-white pb-4 dark:bg-gray-900" : ""}`}>
        <button type="button" onClick={() => onApply(draft)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-dark">
          <SearchIcon className="h-5 w-5" />
          {count === null ? "Show listings" : count === 0 ? "No listings match" : `Show ${count} listing${count === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
