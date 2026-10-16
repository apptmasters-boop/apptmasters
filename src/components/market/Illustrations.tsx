/**
 * Small flat drawings in the brand greens, like the ones in the owner's
 * pictures (Sprint 13h; docs/mockups/more-mobile.jpg, join-home-mobile.jpg).
 * Decorative only: hidden from screen readers.
 */

const BRAND = "#1d5c4b";
const LEAF = "#4f9a7e";
const MINT = "#cfe3da";
const SOFT = "#e7f0ec";

/** A house with a magnifying glass and two trees ("Still looking for a place?"). */
export function SearchHomeArt({ className = "h-16 w-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden fill="none">
      <ellipse cx="60" cy="58" rx="56" ry="22" fill={SOFT} />
      <rect x="11" y="44" width="3" height="18" rx="1.5" fill={BRAND} />
      <ellipse cx="12.5" cy="42" rx="7" ry="11" fill={LEAF} />
      <rect x="104" y="48" width="3" height="14" rx="1.5" fill={BRAND} />
      <ellipse cx="105.5" cy="46" rx="6" ry="9" fill={LEAF} />
      <path d="M28 40 52 22l24 18" stroke={BRAND} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="32" y="38" width="40" height="26" rx="2" fill="#fff" stroke={BRAND} strokeWidth="3" />
      <rect x="38" y="44" width="9" height="8" rx="1" fill={MINT} stroke={BRAND} strokeWidth="2" />
      <rect x="55" y="48" width="10" height="16" rx="1" fill={MINT} stroke={BRAND} strokeWidth="2" />
      <circle cx="76" cy="34" r="13" fill="#fff" fillOpacity="0.85" stroke={BRAND} strokeWidth="4" />
      <path d="m85.5 43.5 9 9" stroke={BRAND} strokeWidth="5" strokeLinecap="round" />
      <path d="M70 31a7 7 0 0 1 7-5" stroke={LEAF} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Person({ x, shirt, skin, hair }: { x: number; shirt: string; skin: string; hair: string }) {
  return (
    <g>
      <path d={`M${x - 18} 140c0-16 8-28 18-28s18 12 18 28Z`} fill={shirt} />
      <circle cx={x} cy={96} r={12} fill={skin} />
      <path d={`M${x - 12} 94c0-8 5-13 12-13s12 5 12 13c-3-5-7-6-12-6s-9 1-12 6Z`} fill={hair} />
    </g>
  );
}

/** A home with three roommates in front of it, trees and a skyline (Join a Home). */
export function HomeTogetherArt({ className = "h-36 w-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 140" className={className} aria-hidden fill="none" preserveAspectRatio="xMidYMax meet">
      <rect width="320" height="140" fill={SOFT} />
      <rect x="20" y="30" width="26" height="80" fill={MINT} />
      <rect x="50" y="48" width="22" height="62" fill={MINT} />
      <rect x="246" y="38" width="24" height="72" fill={MINT} />
      <rect x="274" y="22" width="28" height="88" fill={MINT} />
      <rect x="34" y="78" width="3" height="40" rx="1.5" fill={BRAND} />
      <ellipse cx="35.5" cy="74" rx="11" ry="18" fill={LEAF} />
      <rect x="282" y="80" width="3" height="38" rx="1.5" fill={BRAND} />
      <ellipse cx="283.5" cy="76" rx="10" ry="16" fill={LEAF} />
      <path d="M126 40 160 14l34 26" stroke={BRAND} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="132" y="36" width="56" height="38" rx="2" fill="#fff" stroke={BRAND} strokeWidth="3" />
      <rect x="139" y="43" width="11" height="9" rx="1" fill={MINT} stroke={BRAND} strokeWidth="2" />
      <rect x="170" y="43" width="11" height="9" rx="1" fill={MINT} stroke={BRAND} strokeWidth="2" />
      <rect x="154" y="56" width="12" height="18" rx="1" fill={LEAF} />
      <rect x="0" y="118" width="320" height="22" fill="#d9eae2" />
      <Person x={118} shirt={BRAND} skin="#8d5b3e" hair="#1f1a17" />
      <Person x={160} shirt="#6c5bb5" skin="#e9c9a8" hair="#3b2f2a" />
      <Person x={202} shirt="#8a9399" skin="#c99b78" hair="#5a3d27" />
    </svg>
  );
}
