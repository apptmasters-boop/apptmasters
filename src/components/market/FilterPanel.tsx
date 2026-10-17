"use client";
/**
 * Every Find a Home filter (Sprint 12, look matched to the pictures in Sprint
 * 13d; MARKETPLACE_FLOW.md §4; design docs/mockups/filters-mobile.jpg). Opened
 * by the Filters button: a sheet on phones, a window on computers (Fix F1: no
 * more side panel). It edits a draft; "Show N listings", always in view at the
 * bottom, applies it, with N counted as you choose. Radius comes with the map
 * (Sprint 12f).
 */
import { useEffect, useState } from "react";
import {
  EMPTY_FILTERS, filtersToParams, KINDS, LEASE_FILTERS, LISTED_WITHIN, SIZES, orderedPrices, type SearchFilters,
} from "@/lib/listingSearch";
import { LIFESTYLE_TAGS, ROOM_TYPES, type AmenityKey } from "@/lib/listingFields";
import PriceRange from "./PriceRange";
import {
  AccessibleIcon, BathIcon, BedIcon, BoltIcon, CalendarIcon, CapIcon, CarIcon, DishwasherIcon, ElevatorIcon, FlameIcon, HeartHandIcon,
  HomeIcon, MoonIcon, NoSmokeIcon, PawIcon, PinIcon, QuietIcon, ReceiptIcon, RulerIcon, SearchIcon, ShowerIcon, SlidersIcon,
  SnowflakeIcon, SofaIcon, SunriseIcon, TagIcon, UsersIcon, WasherIcon, WifiIcon, XIcon,
} from "@/components/landing/icons";

type IconType = (p: { className?: string }) => React.ReactNode;

/** The options, in the order of the picture; "laundry" is its own filter (in the unit or the building). */
const OPTIONS: { key: AmenityKey | "laundry"; label: string; icon: IconType }[] = [
  { key: "furnished", label: "Furnished", icon: SofaIcon },
  { key: "petsAllowed", label: "Pet friendly", icon: PawIcon },
  { key: "parking", label: "Parking", icon: CarIcon },
  { key: "laundry", label: "Laundry", icon: WasherIcon },
  { key: "internetIncluded", label: "Wi-Fi", icon: WifiIcon },
  { key: "airConditioning", label: "Air conditioning", icon: SnowflakeIcon },
  { key: "elevator", label: "Elevator", icon: ElevatorIcon },
  { key: "heatIncluded", label: "Heat included", icon: FlameIcon },
  { key: "dishwasher", label: "Dishwasher", icon: DishwasherIcon },
  { key: "utilitiesIncluded", label: "Utilities included", icon: BoltIcon },
  { key: "privateBathroom", label: "Private bathroom", icon: ShowerIcon },
  { key: "accessible", label: "Accessible", icon: AccessibleIcon },
];
const KIND_LABELS: Record<string, string> = { apartment: "Apartment", room: "Room", house: "House" };
/** "What matters to you?" (fix F5, moved here from the signed-out Home). */
const LIFESTYLE_ICONS: Record<string, IconType> = {
  "quiet-household": QuietIcon, "non-smoker": NoSmokeIcon, "pet-friendly": PawIcon,
  "student-friendly": CapIcon, "early-riser": SunriseIcon, "night-owl": MoonIcon,
};

export function Pill({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"} ${className}`}>
      {children}
    </button>
  );
}

function Section({ icon: Icon, title, hint, onClear, children }: {
  icon: IconType; title: string; hint?: string; onClear?: () => void; children: React.ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 py-5 last:border-0 dark:border-gray-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-gray-800 dark:text-gray-200"><Icon className="h-6 w-6" /></span>
          <div>
            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white">{title}</h3>
            {hint && <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
          </div>
        </div>
        {onClear && <button type="button" onClick={onClear} className="shrink-0 text-sm font-medium text-brand hover:underline dark:text-emerald-300">Clear</button>}
      </div>
      {children}
    </section>
  );
}

/** One choice among a few, as pills. */
function OneOf<T>({ options, value, onChange, cols }: { options: [T, string][]; value: T; onChange: (v: T) => void; cols: string }) {
  return (
    <div className={`grid gap-2 ${cols}`}>
      {options.map(([v, text]) => <Pill key={text} active={value === v} onClick={() => onChange(v)} className="px-1">{text}</Pill>)}
    </div>
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

export default function FilterPanel({ value, onApply, onClose }: {
  value: SearchFilters; onApply: (f: SearchFilters) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchFilters>(value);
  // The price boxes keep what's typed; Clear and Reset all start them afresh.
  const [priceKey, setPriceKey] = useState(0);
  const set = (patch: Partial<SearchFilters>) => setDraft(d => ({ ...d, ...patch }));
  const count = useDraftCount(draft);
  const optionOn = (key: AmenityKey | "laundry") => key === "laundry" ? draft.laundry : draft.amenities.includes(key);
  const toggleOption = (key: AmenityKey | "laundry") => key === "laundry"
    ? set({ laundry: !draft.laundry })
    : set({ amenities: draft.amenities.includes(key) ? draft.amenities.filter(a => a !== key) : [...draft.amenities, key] });
  // The tabs' kind replaces the older "whole place or room" and property-type filters.
  const setKind = (kind: SearchFilters["kind"]) => set({
    kind, type: "", propertyType: "", roomType: kind === "room" ? draft.roomType : "",
    roommateLifestyleTag: kind === "room" || kind === "" ? draft.roommateLifestyleTag : "",
  });
  // A roommate choice describes a room to share, so it selects Room too.
  const setLifestyle = (tag: string) => set(tag ? { roommateLifestyleTag: tag, kind: "room", type: "", propertyType: "" } : { roommateLifestyleTag: "" });
  const kinds: [SearchFilters["kind"], string][] = [["", "All"], ...KINDS.map(k => [k.value, KIND_LABELS[k.value]] as [SearchFilters["kind"], string])];
  const apply = () => onApply({ ...draft, ...orderedPrices(draft.minPrice, draft.maxPrice) });

  return (
    // A form, so Enter in the Location (e.g. a ZIP code) or price boxes shows the listings (fix F4).
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <button type="button" onClick={onClose} aria-label="Close filters" className="-ml-1 rounded-full p-1.5 text-gray-800 hover:bg-gray-100 dark:text-gray-200">
          <XIcon className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
        <button type="button" onClick={() => { setDraft({ ...EMPTY_FILTERS, sort: draft.sort }); setPriceKey(k => k + 1); }} className="text-[15px] font-semibold text-brand hover:underline dark:text-emerald-300">Reset all</button>
      </div>

      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <Section icon={PinIcon} title="Location" hint="City, neighborhood, or ZIP code" onClear={draft.q ? () => set({ q: "" }) : undefined}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input aria-label="Location" enterKeyHint="search" value={draft.q} onChange={e => set({ q: e.target.value })} placeholder="New York, Brooklyn, or 11226" className={`${inputClass} pl-10`} />
          </div>
        </Section>

        <Section icon={HomeIcon} title="Property type"
          onClear={draft.kind || draft.type || draft.propertyType || draft.roomType ? () => setKind("") : undefined}>
          <div className="grid grid-cols-4 gap-2">
            {kinds.map(([v, label]) => <Pill key={label} active={draft.kind === v && !draft.type && !draft.propertyType} onClick={() => setKind(v)} className="px-2">{label}</Pill>)}
          </div>
          {draft.kind === "room" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill active={!draft.roomType} onClick={() => set({ roomType: "" })}>Any room</Pill>
              {ROOM_TYPES.map(r => <Pill key={r.value} active={draft.roomType === r.value} onClick={() => set({ roomType: r.value })}>{r.label}</Pill>)}
            </div>
          )}
        </Section>

        <Section icon={TagIcon} title="Price range" hint="Per month"
          onClear={draft.minPrice !== null || draft.maxPrice !== null ? () => { set({ minPrice: null, maxPrice: null }); setPriceKey(k => k + 1); } : undefined}>
          <PriceRange key={priceKey} min={draft.minPrice} max={draft.maxPrice}
            onChange={(minPrice, maxPrice) => set({ minPrice, maxPrice })} />
        </Section>

        <Section icon={BedIcon} title="Bedrooms" onClear={draft.bedrooms ? () => set({ bedrooms: "" }) : undefined}>
          <OneOf cols="grid-cols-5" value={draft.bedrooms} onChange={bedrooms => set({ bedrooms })}
            options={[["", "Any"], ["0", "Studio"], ["1", "1"], ["2", "2"], ["3+", "3+"]]} />
        </Section>

        <Section icon={UsersIcon} title="Number of occupants" hint="How many people will live there, you included?" onClear={draft.occupants ? () => set({ occupants: null }) : undefined}>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(n => <Pill key={n} active={draft.occupants === n} onClick={() => set({ occupants: draft.occupants === n ? null : n })} className="px-1">{n === 5 ? "5+" : n}</Pill>)}
          </div>
        </Section>

        <Section icon={BathIcon} title="Bathrooms" onClear={draft.bathrooms ? () => set({ bathrooms: null }) : undefined}>
          <OneOf cols="grid-cols-4" value={draft.bathrooms} onChange={bathrooms => set({ bathrooms })}
            options={[[null, "Any"], [1, "1+"], [2, "2+"], [3, "3+"]]} />
        </Section>

        <Section icon={CalendarIcon} title="Move-in date" hint="Available by then" onClear={draft.moveIn ? () => set({ moveIn: "" }) : undefined}>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input type="date" aria-label="Move-in date" value={draft.moveIn} onChange={e => set({ moveIn: e.target.value })} className={`${inputClass} pl-11`} />
          </div>
        </Section>

        <Section icon={SlidersIcon} title="Additional options"
          onClear={draft.amenities.length || draft.laundry ? () => set({ amenities: [], laundry: false }) : undefined}>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map(({ key, label, icon: Icon }) => <Pill key={key} active={optionOn(key)} onClick={() => toggleOption(key)}><Icon className="h-5 w-5" />{label}</Pill>)}
          </div>
        </Section>

        <Section icon={HeartHandIcon} title="What matters to you?" hint="Rooms to share: how the people there live"
          onClear={draft.roommateLifestyleTag ? () => setLifestyle("") : undefined}>
          <div className="flex flex-wrap gap-2">
            <Pill active={!draft.roommateLifestyleTag} onClick={() => setLifestyle("")}>Any</Pill>
            {LIFESTYLE_TAGS.map(t => {
              const Icon = LIFESTYLE_ICONS[t.value];
              return <Pill key={t.value} active={draft.roommateLifestyleTag === t.value} onClick={() => setLifestyle(t.value)}><Icon className="h-5 w-5" />{t.label}</Pill>;
            })}
          </div>
        </Section>

        <Section icon={RulerIcon} title="Size" hint="Square feet" onClear={draft.minSqft ? () => set({ minSqft: null }) : undefined}>
          <OneOf cols="grid-cols-5" value={draft.minSqft} onChange={minSqft => set({ minSqft })}
            options={[[null, "Any"], ...SIZES.map(s => [s, `${s.toLocaleString("en-US")}+`] as [number, string])]} />
        </Section>

        <Section icon={ReceiptIcon} title="Lease duration" onClear={draft.lease ? () => set({ lease: "" }) : undefined}>
          <OneOf cols="grid-cols-2" value={draft.lease} onChange={lease => set({ lease })}
            options={[["", "Any"], ...LEASE_FILTERS.map(l => [l.value, l.label] as [SearchFilters["lease"], string])]} />
        </Section>

        <Section icon={NoSmokeIcon} title="Smoking" onClear={draft.smoking ? () => set({ smoking: "" }) : undefined}>
          <OneOf cols="grid-cols-3" value={draft.smoking} onChange={smoking => set({ smoking })}
            options={[["", "Any"], ["free", "Smoke-free"], ["allowed", "Allowed"]] as [SearchFilters["smoking"], string][]} />
        </Section>

        <Section icon={TagIcon} title="Fees" onClear={draft.noBrokerFee || draft.noApplicationFee ? () => set({ noBrokerFee: false, noApplicationFee: false }) : undefined}>
          <div className="flex flex-wrap gap-2">
            <Pill active={draft.noBrokerFee} onClick={() => set({ noBrokerFee: !draft.noBrokerFee })}>No broker fee</Pill>
            <Pill active={draft.noApplicationFee} onClick={() => set({ noApplicationFee: !draft.noApplicationFee })}>No application fee</Pill>
          </div>
        </Section>

        <Section icon={CalendarIcon} title="Listed" onClear={draft.listedWithin ? () => set({ listedWithin: null }) : undefined}>
          <OneOf cols="grid-cols-2" value={draft.listedWithin} onChange={listedWithin => set({ listedWithin })}
            options={[[null, "Any time"], ...LISTED_WITHIN.map(l => [l.value, l.label] as [number, string])]} />
        </Section>
      </div>

      <div className="border-t border-gray-100 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-gray-800 dark:bg-gray-900">
        <button type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-dark">
          {count === null ? "Show listings" : count === 0 ? "No listings match" : `Show ${count} listing${count === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}
