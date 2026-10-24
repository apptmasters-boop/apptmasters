"use client";
/**
 * The price range (Sprint 13d; fix F8): two handles from $0 to $5,000+ (the
 * top end means no limit), the amounts above them, and Min / Max boxes that
 * keep what's typed ("1,500", "$900"). Used by the Filters window and the Price
 * button on top of the results and on Home.
 */
import { useState } from "react";
import { parseAmount } from "@/lib/listingSearch";

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

/**
 * Two handles from $0 to $5,000+ (the top end means no limit), the amounts above them, and
 * Min / Max boxes that keep what you type ("1,500", "$900") and read it as a number (Fix F1).
 */
export default function PriceRange({ min, max, onChange }: { min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  const [minText, setMinText] = useState(min?.toString() ?? "");
  const [maxText, setMaxText] = useState(max?.toString() ?? "");
  const lo = Math.min(min ?? 0, PRICE_MAX - PRICE_STEP);
  const hi = Math.min(max ?? PRICE_MAX, PRICE_MAX);
  const pct = (v: number) => (v / PRICE_MAX) * 100;
  // The amount above a handle stays inside the panel at both ends (Fix F1).
  const bubble = (v: number) => ({ left: `${pct(v)}%`, translate: pct(v) > 85 ? "-100% 0" : pct(v) < 15 ? "0 0" : "-50% 0" });
  function slide(nextMin: number | null, nextMax: number | null) {
    setMinText(nextMin?.toString() ?? "");
    setMaxText(nextMax?.toString() ?? "");
    onChange(nextMin, nextMax);
  }
  return (
    <div>
      <div className="relative mx-3 mt-10 h-6">
        <span className="absolute -top-10 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-100" style={bubble(lo)}>
          {money(min ?? 0)}
        </span>
        <span className="absolute -top-10 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-100" style={bubble(hi)}>
          {max === null ? `${money(PRICE_MAX)}+` : money(max)}
        </span>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={0} max={PRICE_MAX} step={PRICE_STEP} value={lo} aria-label="Minimum price slider" aria-valuetext={money(lo)}
          onChange={e => { const v = Math.min(Number(e.target.value), hi - PRICE_STEP); slide(v <= 0 ? null : v, max); }}
          className={`${thumb} ${lo >= PRICE_MAX - 4 * PRICE_STEP ? "z-20" : "z-10"}`} />
        <input type="range" min={0} max={PRICE_MAX} step={PRICE_STEP} value={hi} aria-label="Maximum price slider" aria-valuetext={max === null ? "No limit" : money(hi)}
          onChange={e => { const v = Math.max(Number(e.target.value), lo + PRICE_STEP); slide(min, v >= PRICE_MAX ? null : v); }}
          className={`${thumb} z-10`} />
      </div>
      <div className="mt-2 flex justify-between px-1 text-xs text-gray-500 dark:text-gray-400"><span>$0</span><span>{money(PRICE_MAX)}+</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="relative">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input inputMode="numeric" aria-label="Minimum price" value={minText} placeholder="Min" className={`${inputClass} ps-7`}
            onChange={e => { setMinText(e.target.value); onChange(parseAmount(e.target.value), max); }} />
        </label>
        <label className="relative">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input inputMode="numeric" aria-label="Maximum price" value={maxText} placeholder="Max" className={`${inputClass} ps-7`}
            onChange={e => { setMaxText(e.target.value); onChange(min, parseAmount(e.target.value)); }} />
        </label>
      </div>
      {min !== null && max !== null && min > max && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Min is above Max: they&apos;ll be swapped.</p>
      )}
    </div>
  );
}
