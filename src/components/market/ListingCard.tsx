"use client";
/**
 * A listing in search results, Saved and on Home (Sprint 12, look matched to
 * the pictures in Sprint 13c; MARKETPLACE_FLOW.md §6; designs
 * docs/mockups/search-results-mobile.jpg, find-a-home-desktop.jpg): photo, the
 * save heart, the price, title, place (never the street address), bedrooms,
 * bathrooms, how many people, the kind of place, availability, a few details
 * and, on the desktop card, the advertiser.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "./useMe";
import { useSavedIds, toggleSaved, saveSignInPath } from "./saved";
import { amenityLabels, placeKind, type ListingDetails } from "@/lib/listingFields";
import { BathIcon, BedIcon, BuildingIcon, CalendarIcon, HeartIcon, HomeIcon, PinIcon, UsersIcon } from "@/components/landing/icons";

export interface MarketListing extends Partial<ListingDetails> {
  id: string;
  type: string;
  status?: string;
  title: string;
  price: number;
  priceMax: number | null;
  city: string;
  state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  availableFrom: string | null;
  createdAt: string;
  photos: { url: string }[];
  _count?: { photos: number };
  owner?: { id: string; name: string; since?: string; photo?: string | null };
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const priceText = (l: Pick<MarketListing, "price" | "priceMax">) => `${money(l.price)}${l.priceMax ? `–${money(l.priceMax)}` : ""}/mo`;
const priceMonthText = (l: Pick<MarketListing, "price" | "priceMax">) => `${money(l.price)}${l.priceMax ? `–${money(l.priceMax)}` : ""}/month`;

/** "Bushwick, Brooklyn, NY 11216": neighborhood, city, state and ZIP, never the street. */
export function placeText(l: Pick<MarketListing, "city" | "state" | "neighborhood" | "zipCode">) {
  const where = [l.neighborhood, l.city].filter(Boolean).join(", ");
  const region = [l.state, l.zipCode].filter(Boolean).join(" ");
  return [where, region].filter(Boolean).join(", ");
}

/** "Brooklyn, NY 11216": the short place on phone cards. */
const cityText = (l: Pick<MarketListing, "city" | "state" | "zipCode">) =>
  [l.city, [l.state, l.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export function availableText(availableFrom: string | null, now = new Date()) {
  if (!availableFrom) return null;
  const d = new Date(availableFrom);
  return d <= now ? "Available now" : `Available ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

export const isNew = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 3 * 86_400_000;

export function postedAgo(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "1 day ago" : days < 30 ? `${days} days ago` : new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SaveButton({ listingId, className = "", onImage = true, large = false }: { listingId: string; className?: string; onImage?: boolean; large?: boolean }) {
  const me = useMe();
  const router = useRouter();
  const saved = useSavedIds().has(listingId);
  return (
    <button type="button" aria-pressed={saved} aria-label={saved ? "Remove from Saved" : "Save"}
      onClick={() => { if (me === null) router.push(saveSignInPath(listingId)); else if (me) toggleSaved(listingId); }}
      className={`flex ${large ? "h-11 w-11" : "h-9 w-9"} items-center justify-center rounded-full transition-transform active:scale-90 ${
        onImage ? "bg-white/90 shadow-sm backdrop-blur hover:bg-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"} ${className}`}>
      <HeartIcon filled={saved} className={`h-5 w-5 ${saved ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`} />
    </button>
  );
}

function Photo({ l, className, showNew = true, showPrice = true, showCount = false }: {
  l: MarketListing; className: string; showNew?: boolean; showPrice?: boolean; showCount?: boolean;
}) {
  const count = l._count?.photos ?? l.photos.length;
  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}>
      {l.photos[0] ? (
        // Listing photos are user uploads served by nginx, like elsewhere in the app
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.photos[0].url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>
      )}
      {showNew && isNew(l.createdAt) && <span className="absolute start-2.5 top-2.5 rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">New</span>}
      {showPrice && <span className="absolute bottom-2.5 start-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-sm font-bold text-white">{priceText(l)}</span>}
      {showCount && count > 0 && <span className="absolute bottom-2.5 start-2.5 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-medium text-white">{count} photo{count === 1 ? "" : "s"}</span>}
      {l.photos.length > 1 && (
        <span className="absolute bottom-3.5 end-3 flex gap-1" aria-hidden>
          {l.photos.slice(0, 3).map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/60"}`} />)}
        </span>
      )}
    </div>
  );
}

/** Short names for the row of details on cards. */
const SHORT: Record<string, string> = {
  "Wi-Fi included": "Wi-Fi", "Utilities included": "Utilities", "Private bathroom": "Private bath", "Pets allowed": "Pet friendly",
  "Air conditioning": "A/C", "Heat included": "Heat",
};

/** One row of details; the ones that don't fit are hidden rather than wrapped onto a second row. */
function Chips({ l, max }: { l: MarketListing; max: number }) {
  const chips = amenityLabels(l).slice(0, max).map(c => SHORT[c] ?? c);
  if (chips.length === 0) return null;
  return (
    <div className="flex max-h-[1.625rem] flex-wrap gap-1.5 overflow-hidden">
      {chips.map(c => <span key={c} className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium leading-none text-gray-700 dark:bg-gray-800 dark:text-gray-200">{c}</span>)}
    </div>
  );
}

function Unavailable({ status }: { status?: string }) {
  if (!status || status === "APPROVED") return null;
  return <span className="inline-block rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">{status === "RENTED" ? "Rented" : "No longer available"}</span>;
}

/** The advertiser's profile photo, or their initial. */
function OwnerAvatar({ owner }: { owner: NonNullable<MarketListing["owner"]> }) {
  return owner.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={owner.photo} alt="" className="h-7 w-7 rounded-full object-cover" />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{owner.name[0]?.toUpperCase()}</span>
  );
}

const fact = "inline-flex items-center gap-1";

/**
 * `row`: photo on the left, as on phones and in the desktop list. `grid`: the
 * desktop card, price first. `tile`: Home's small card. Saved adds a "…" menu
 * (`menu`), "Saved 2 days ago" (`ago`) and the number of photos (`photoCount`).
 */
export default function ListingCard({ listing: l, layout = "row", footer, menu, ago, photoCount = false }: {
  listing: MarketListing; layout?: "row" | "grid" | "tile"; footer?: React.ReactNode;
  menu?: React.ReactNode; ago?: string; photoCount?: boolean;
}) {
  const gone = !!l.status && l.status !== "APPROVED";
  // A closed listing never claims to be available, or new (fix F18, owner 2026-10-18).
  const available = gone ? null : availableText(l.availableFrom);
  const kind = placeKind(l);

  if (layout === "tile") {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Link href={`/listings/${l.id}`} className="block">
          <Photo l={l} className="aspect-[4/3]" showNew={false} />
          <div className="space-y-1 p-3">
            <h3 className="truncate text-[15px] font-semibold text-gray-900 group-hover:text-brand dark:text-white">{l.title}</h3>
            <p className="flex items-center gap-1 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{[l.city, l.state].filter(Boolean).join(", ")}</p>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
              {l.bedrooms !== null && <span className={fact}><BedIcon className="h-3.5 w-3.5" />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}</span>}
              {l.bathrooms !== null && <span className={fact}><BathIcon className="h-3.5 w-3.5" />{l.bathrooms} ba</span>}
              {available && <span className={fact}><CalendarIcon className="h-3.5 w-3.5" />{available}</span>}
            </p>
          </div>
        </Link>
        <SaveButton listingId={l.id} className="absolute end-2.5 top-2.5" />
      </article>
    );
  }

  if (layout === "grid") {
    return (
      <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg hover:shadow-black/5 dark:border-gray-800 dark:bg-gray-900 ${gone ? "opacity-70" : ""}`}>
        <Link href={`/listings/${l.id}`} className="flex flex-1 flex-col">
          <Photo l={l} className="aspect-[2/1]" showNew={!gone} showPrice={false} showCount={photoCount} />
          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <Unavailable status={l.status} />
            <p className={`text-lg font-bold leading-tight text-gray-900 dark:text-white ${menu ? "pe-9" : ""}`}>{priceMonthText(l)}</p>
            <h3 className="truncate text-[15px] font-semibold text-gray-900 group-hover:text-brand dark:text-white">{l.title}</h3>
            <p className="flex items-center gap-1.5 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{placeText(l)}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-600 dark:text-gray-300">
              {l.maxOccupants ? <span className={fact}><UsersIcon className="h-4 w-4" />Up to {l.maxOccupants} {l.maxOccupants === 1 ? "person" : "people"}</span> : null}
              {l.bedrooms !== null && <span className={fact}><BedIcon className="h-4 w-4" />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}`}</span>}
              {l.bathrooms !== null && <span className={fact}><BathIcon className="h-4 w-4" />{l.bathrooms} bathroom{l.bathrooms === 1 ? "" : "s"}</span>}
            </p>
            {available && <p className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-300"><CalendarIcon className="h-4 w-4" />{available}</p>}
            <div className="mt-1"><Chips l={l} max={3} /></div>
            {!l.owner && ago && <p className="mt-auto pt-3 text-[13px] text-gray-500 dark:text-gray-400">{ago}</p>}
            {l.owner && (
              <p className="mt-auto flex items-center justify-between gap-3 pt-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
                  <OwnerAvatar owner={l.owner} /><span className="truncate">{l.owner.name}</span>
                </span>
                <span className="shrink-0 text-gray-500 dark:text-gray-400">{ago ?? postedAgo(l.createdAt)}</span>
              </p>
            )}
          </div>
        </Link>
        {!gone && <SaveButton listingId={l.id} className="absolute end-3 top-3" />}
        {/* Same size as the photo, so the menu lines up with the price under it. */}
        {menu && <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/1]"><div className="pointer-events-auto absolute end-2.5 top-full mt-3">{menu}</div></div>}
        {footer}
      </article>
    );
  }

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${gone ? "opacity-70" : ""}`}>
      <Link href={`/listings/${l.id}`} className="grid grid-cols-[44%_1fr] gap-3 p-2.5 sm:grid-cols-[17rem_1fr] sm:gap-5 sm:p-3">
        <Photo l={l} className="min-h-[9.5rem] rounded-xl sm:min-h-[11rem]" showNew={!gone} />
        <div className="min-w-0 space-y-1.5 py-0.5 sm:py-1.5">
          <Unavailable status={l.status} />
          <h3 className={`truncate text-[15px] font-semibold text-gray-900 sm:text-base dark:text-white ${menu ? "pe-8" : ""}`}>{l.title}</h3>
          <p className="flex items-center gap-1 truncate text-[13px] text-gray-600 dark:text-gray-300">
            <PinIcon className="h-4 w-4 shrink-0" /><span className="truncate"><span className="sm:hidden">{cityText(l)}</span><span className="hidden sm:inline">{placeText(l)}</span></span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-gray-600 dark:text-gray-300">
            {l.bedrooms !== null && <span className={fact}><BedIcon className="h-4 w-4" />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}</span>}
            {l.bathrooms !== null && <span className={fact}><BathIcon className="h-4 w-4" />{l.bathrooms} ba</span>}
            {l.maxOccupants ? <span className={fact}><UsersIcon className="h-4 w-4" />Max {l.maxOccupants}</span> : null}
            <span className={fact}><BuildingIcon className="h-4 w-4" />{kind}</span>
          </p>
          {available && <p className="flex items-center gap-1 text-[13px] text-gray-600 dark:text-gray-300"><CalendarIcon className="h-4 w-4" />{available}</p>}
          <Chips l={l} max={4} />
        </div>
      </Link>
      {!gone && <SaveButton listingId={l.id} className="absolute start-[calc(44%-2.75rem)] top-4 sm:start-[15rem] sm:top-[1.25rem]" />}
      {menu && <div className="absolute end-1.5 top-2 sm:end-2.5 sm:top-3">{menu}</div>}
      {footer}
    </article>
  );
}
