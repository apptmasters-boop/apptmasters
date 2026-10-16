"use client";
/**
 * Every Find a Home filter (Sprint 12, look matched to the pictures in Sprint
 * 13d; MARKETPLACE_FLOW.md §4; designs docs/mockups/filters-mobile.jpg and the
 * left panel of find-a-home-desktop.jpg). The same filters are the Filters
 * sheet on phones (pills with icons) and the side panel on desktop (tick
 * boxes, "Apply filters"). It edits a draft; applying it searches, with the
 * count shown as you choose. Radius comes with the map (Sprint 12f).
 */
import { useEffect, useState } from "react";
import { EMPTY_FILTERS, filtersToParams, KINDS, LEASE_FILTERS, LISTED_WITHIN, SIZES, type SearchFilters } from "@/lib/listingSearch";
import { ROOM_TYPES, type AmenityKey } from "@/lib/listingFields";
import {
  AccessibleIcon, BathIcon, BedIcon, BoltIcon, CalendarIcon, CarIcon, CheckIcon, DishwasherIcon, ElevatorIcon, FlameIcon, HomeIcon,
  NoSmokeIcon, PawIcon, PinIcon, ReceiptIcon, RulerIcon, SearchIcon, ShowerIcon, SlidersIcon, SnowflakeIcon, SofaIcon, TagIcon,
  UsersIcon, WasherIcon, WifiIcon, XIcon,
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

export function Pill({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"} ${className}`}>
      {children}
    </button>
  );
}

/** A tick box or a round choice, as in the desktop picture. */
function Choice({ active, onClick, round = false, children }: { active: boolean; onClick: () => void; round?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} role={round ? "radio" : "checkbox"} aria-checked={active}
      className="flex w-full items-center gap-2.5 py-1.5 text-left text-sm text-gray-800 dark:text-gray-200">
      <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border-[1.5px] ${round ? "rounded-full" : "rounded-[5px]"} ${
        active ? "border-brand bg-brand text-white" : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"}`}>
        {active && (round ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <CheckIcon className="h-3 w-3" />)}
      </span>
      {children}
    </button>
  );
}

function Section({ icon: Icon, title, hint, onClear, sidebar, children }: {
  icon: IconType; title: string; hint?: string; onClear?: () => void; sidebar: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`border-b border-gray-100 last:border-0 dark:border-gray-800 ${sidebar ? "py-4" : "py-5"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 ${sidebar ? "text-brand dark:text-emerald-300" : "text-gray-800 dark:text-gray-200"}`}><Icon className={sidebar ? "h-5 w-5" : "h-6 w-6"} /></span>
          <div>
            <h3 className={`font-semibold text-gray-900 dark:text-white ${sidebar ? "text-sm" : "text-[17px]"}`}>{title}</h3>
            {hint && <p className={`text-gray-500 dark:text-gray-400 ${sidebar ? "text-xs" : "text-sm"}`}>{hint}</p>}
          </div>
        </div>
        {onClear && <button type="button" onClick={onClear} className="shrink-0 text-sm font-medium text-brand hover:underline dark:text-emerald-300">Clear</button>}
      </div>
      {children}
    </section>
  );
}

/** One choice among a few: pills on the phone sheet, round choices in the desktop panel. */
function OneOf<T>({ sidebar, options, value, onChange, cols, label }: {
  sidebar: boolean; options: [T, string][]; value: T; onChange: (v: T) => void; cols: string; label: string;
}) {
  if (sidebar) {
    return (
      <div role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => <Choice key={text} round active={value === v} onClick={() => onChange(v)}>{text}</Choice>)}
      </div>
    );
  }
  return (
    <div className={`grid gap-2 ${cols}`}>
      {options.map(([v, text]) => <Pill key={text} active={value === v} onClick={() => onChange(v)} className="px-1">{text}</Pill>)}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white";

const PRICE_MAX = 5000;
const PRICE_STEP = 50;
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const thumb = [
  "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent focus-visible:outline-none",
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer",
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-brand",
  "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&:focus-visible::-webkit-slider-thumb]:ring-4 [&:focus-visible::-webkit-slider-thumb]:ring-brand/25",
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-brand [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent",
].join(" ");

/** Two handles from $0 to $5,000+ (the top end means no limit), the amounts above them, and Min / Max boxes. */
function PriceRange({ min, max, onChange }: { min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  const lo = Math.min(min ?? 0, PRICE_MAX - PRICE_STEP);
  const hi = Math.min(max ?? PRICE_MAX, PRICE_MAX);
  const pct = (v: number) => (v / PRICE_MAX) * 100;
  const typed = (v: string) => { const n = Number(v); return v === "" || !Number.isFinite(n) || n < 0 ? null : n; };
  return (
    <div>
      <div className="relative mx-3 mt-10 h-6">
        <span className="absolute -top-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-100" style={{ left: `${pct(lo)}%` }}>
          {money(min ?? 0)}
        </span>
        <span className="absolute -top-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-100" style={{ left: `${pct(hi)}%` }}>
          {max === null ? `${money(PRICE_MAX)}+` : money(max)}
        </span>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={0} max={PRICE_MAX} step={PRICE_STEP} value={lo} aria-label="Minimum price" aria-valuetext={money(lo)}
          onChange={e => { const v = Math.min(Number(e.target.value), hi - PRICE_STEP); onChange(v <= 0 ? null : v, max); }}
          className={`${thumb} ${lo >= PRICE_MAX - 4 * PRICE_STEP ? "z-20" : "z-10"}`} />
        <input type="range" min={0} max={PRICE_MAX} step={PRICE_STEP} value={hi} aria-label="Maximum price" aria-valuetext={max === null ? "No limit" : money(hi)}
          onChange={e => { const v = Math.max(Number(e.target.value), lo + PRICE_STEP); onChange(min, v >= PRICE_MAX ? null : v); }}
          className={`${thumb} z-10`} />
      </div>
      <div className="mt-2 flex justify-between px-1 text-xs text-gray-500 dark:text-gray-400"><span>$0</span><span>{money(PRICE_MAX)}+</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input inputMode="numeric" aria-label="Minimum price" value={min ?? ""} onChange={e => onChange(typed(e.target.value), max)} placeholder="Min" className={`${inputClass} pl-7`} />
        </label>
        <label className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input inputMode="numeric" aria-label="Maximum price" value={max ?? ""} onChange={e => onChange(min, typed(e.target.value))} placeholder="Max" className={`${inputClass} pl-7`} />
        </label>
      </div>
    </div>
  );
}

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
  // With a close button it's the phone sheet; without, the desktop side panel.
  const sidebar = !onClose;
  const [draft, setDraft] = useState<SearchFilters>(value);
  const set = (patch: Partial<SearchFilters>) => setDraft(d => ({ ...d, ...patch }));
  const count = useDraftCount(draft);
  const optionOn = (key: AmenityKey | "laundry") => key === "laundry" ? draft.laundry : draft.amenities.includes(key);
  const toggleOption = (key: AmenityKey | "laundry") => key === "laundry"
    ? set({ laundry: !draft.laundry })
    : set({ amenities: draft.amenities.includes(key) ? draft.amenities.filter(a => a !== key) : [...draft.amenities, key] });
  // The tabs' kind replaces the older "whole place or room" and property-type filters.
  const setKind = (kind: SearchFilters["kind"]) => set({ kind, type: "", propertyType: "", roomType: kind === "room" ? draft.roomType : "" });
  const kinds: [SearchFilters["kind"], string][] = [["", "All"], ...KINDS.map(k => [k.value, KIND_LABELS[k.value]] as [SearchFilters["kind"], string])];
  const reset = () => setDraft({ ...EMPTY_FILTERS, sort: draft.sort });

  return (
    <div className="flex h-full flex-col">
      {sidebar ? (
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filters</h2>
          <button type="button" onClick={reset} className="text-sm font-semibold text-brand hover:underline dark:text-emerald-300">Clear all</button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <button type="button" onClick={onClose} aria-label="Close filters" className="-ml-1 rounded-full p-1.5 text-gray-800 hover:bg-gray-100 dark:text-gray-200">
            <XIcon className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
          <button type="button" onClick={reset} className="text-[15px] font-semibold text-brand hover:underline dark:text-emerald-300">Reset all</button>
        </div>
      )}

      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        <Section sidebar={sidebar} icon={PinIcon} title="Location" hint={sidebar ? undefined : "City, neighborhood, or ZIP code"} onClear={draft.q ? () => set({ q: "" }) : undefined}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input aria-label="Location" value={draft.q} onChange={e => set({ q: e.target.value })} placeholder="New York, Brooklyn, or 11226" className={`${inputClass} pl-10`} />
          </div>
        </Section>

        <Section sidebar={sidebar} icon={HomeIcon} title="Property type"
          onClear={draft.kind || draft.type || draft.propertyType || draft.roomType ? () => setKind("") : undefined}>
          {sidebar ? (
            <div role="radiogroup" aria-label="Property type">
              {kinds.map(([v, label]) => <Choice key={label} round active={draft.kind === v && !draft.type && !draft.propertyType} onClick={() => setKind(v)}>{label}</Choice>)}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {kinds.map(([v, label]) => <Pill key={label} active={draft.kind === v && !draft.type && !draft.propertyType} onClick={() => setKind(v)} className="px-2">{label}</Pill>)}
            </div>
          )}
          {draft.kind === "room" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill active={!draft.roomType} onClick={() => set({ roomType: "" })}>Any room</Pill>
              {ROOM_TYPES.map(r => <Pill key={r.value} active={draft.roomType === r.value} onClick={() => set({ roomType: r.value })}>{r.label}</Pill>)}
            </div>
          )}
        </Section>

        <Section sidebar={sidebar} icon={TagIcon} title="Price range" hint="Per month"
          onClear={draft.minPrice !== null || draft.maxPrice !== null ? () => set({ minPrice: null, maxPrice: null }) : undefined}>
          <PriceRange min={draft.minPrice} max={draft.maxPrice} onChange={(minPrice, maxPrice) => set({ minPrice, maxPrice })} />
        </Section>

        <Section sidebar={sidebar} icon={BedIcon} title="Bedrooms" onClear={draft.bedrooms ? () => set({ bedrooms: "" }) : undefined}>
          {sidebar ? (
            <select aria-label="Bedrooms" value={draft.bedrooms} onChange={e => set({ bedrooms: e.target.value })} className={`${inputClass} cursor-pointer`}>
              <option value="">Any</option><option value="0">Studio</option><option value="1">1 bedroom</option><option value="2">2 bedrooms</option><option value="3+">3+ bedrooms</option>
            </select>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {[["", "Any"], ["0", "Studio"], ["1", "1"], ["2", "2"], ["3+", "3+"]].map(([v, label]) =>
                <Pill key={v} active={draft.bedrooms === v} onClick={() => set({ bedrooms: v })} className="px-1">{label}</Pill>)}
            </div>
          )}
        </Section>

        <Section sidebar={sidebar} icon={UsersIcon} title="Number of occupants" hint="How many people will live there, you included?" onClear={draft.occupants ? () => set({ occupants: null }) : undefined}>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(n => <Pill key={n} active={draft.occupants === n} onClick={() => set({ occupants: draft.occupants === n ? null : n })} className="px-1">{n === 5 ? "5+" : n}</Pill>)}
          </div>
        </Section>

        <Section sidebar={sidebar} icon={BathIcon} title="Bathrooms" onClear={draft.bathrooms ? () => set({ bathrooms: null }) : undefined}>
          <div className="grid grid-cols-4 gap-2">
            {[[null, "Any"], [1, "1+"], [2, "2+"], [3, "3+"]].map(([v, label]) =>
              <Pill key={String(label)} active={draft.bathrooms === v} onClick={() => set({ bathrooms: v as number | null })} className="px-1">{label}</Pill>)}
          </div>
        </Section>

        <Section sidebar={sidebar} icon={CalendarIcon} title="Move-in date" hint="Available by then" onClear={draft.moveIn ? () => set({ moveIn: "" }) : undefined}>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input type="date" aria-label="Move-in date" value={draft.moveIn} onChange={e => set({ moveIn: e.target.value })} className={`${inputClass} pl-11`} />
          </div>
        </Section>

        <Section sidebar={sidebar} icon={SlidersIcon} title={sidebar ? "Amenities" : "Additional options"}
          onClear={draft.amenities.length || draft.laundry ? () => set({ amenities: [], laundry: false }) : undefined}>
          {sidebar ? (
            <div>{OPTIONS.map(o => <Choice key={o.key} active={optionOn(o.key)} onClick={() => toggleOption(o.key)}>{o.label}</Choice>)}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map(({ key, label, icon: Icon }) => <Pill key={key} active={optionOn(key)} onClick={() => toggleOption(key)}><Icon className="h-5 w-5" />{label}</Pill>)}
            </div>
          )}
        </Section>

        <Section sidebar={sidebar} icon={RulerIcon} title="Size" hint="Square feet" onClear={draft.minSqft ? () => set({ minSqft: null }) : undefined}>
          <OneOf sidebar={sidebar} label="Size" cols="grid-cols-5" value={draft.minSqft} onChange={minSqft => set({ minSqft })}
            options={[[null, "Any"], ...SIZES.map(s => [s, `${s.toLocaleString("en-US")}+`] as [number, string])]} />
        </Section>

        <Section sidebar={sidebar} icon={ReceiptIcon} title="Lease duration" onClear={draft.lease ? () => set({ lease: "" }) : undefined}>
          <OneOf sidebar={sidebar} label="Lease duration" cols="grid-cols-2" value={draft.lease} onChange={lease => set({ lease })}
            options={[["", "Any"], ...LEASE_FILTERS.map(l => [l.value, l.label] as [SearchFilters["lease"], string])]} />
        </Section>

        <Section sidebar={sidebar} icon={NoSmokeIcon} title="Smoking" onClear={draft.smoking ? () => set({ smoking: "" }) : undefined}>
          <OneOf sidebar={sidebar} label="Smoking" cols="grid-cols-3" value={draft.smoking} onChange={smoking => set({ smoking })}
            options={[["", "Any"], ["free", "Smoke-free"], ["allowed", "Allowed"]] as [SearchFilters["smoking"], string][]} />
        </Section>

        <Section sidebar={sidebar} icon={TagIcon} title="Fees" onClear={draft.noBrokerFee || draft.noApplicationFee ? () => set({ noBrokerFee: false, noApplicationFee: false }) : undefined}>
          {sidebar ? (
            <div>
              <Choice active={draft.noBrokerFee} onClick={() => set({ noBrokerFee: !draft.noBrokerFee })}>No broker fee</Choice>
              <Choice active={draft.noApplicationFee} onClick={() => set({ noApplicationFee: !draft.noApplicationFee })}>No application fee</Choice>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Pill active={draft.noBrokerFee} onClick={() => set({ noBrokerFee: !draft.noBrokerFee })}>No broker fee</Pill>
              <Pill active={draft.noApplicationFee} onClick={() => set({ noApplicationFee: !draft.noApplicationFee })}>No application fee</Pill>
            </div>
          )}
        </Section>

        <Section sidebar={sidebar} icon={CalendarIcon} title="Listed" onClear={draft.listedWithin ? () => set({ listedWithin: null }) : undefined}>
          <OneOf sidebar={sidebar} label="Listed" cols="grid-cols-2" value={draft.listedWithin} onChange={listedWithin => set({ listedWithin })}
            options={[[null, "Any time"], ...LISTED_WITHIN.map(l => [l.value, l.label] as [number, string])]} />
        </Section>
      </div>

      <div className={`border-t border-gray-100 pt-4 dark:border-gray-800 ${sticky ? "sticky bottom-0 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-gray-900" : ""}`}>
        <button type="button" onClick={() => onApply(draft)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white hover:bg-brand-dark">
          {sidebar ? (
            <><SearchIcon className="h-5 w-5" />Apply filters</>
          ) : count === null ? "Show listings" : count === 0 ? "No listings match" : `Show ${count} listing${count === 1 ? "" : "s"}`}
        </button>
        {sidebar && count !== null && (
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">{count === 0 ? "No listings match" : `${count} listing${count === 1 ? "" : "s"} match`}</p>
        )}
      </div>
    </div>
  );
}
