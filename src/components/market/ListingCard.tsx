"use client";
/**
 * A listing in search results, Saved and on Home (Sprint 12;
 * MARKETPLACE_FLOW.md §6; designs docs/mockups/search-results-mobile.jpg,
 * find-a-home-desktop.jpg): photo with the price, the save heart, title, place
 * (never the street address), bedrooms, bathrooms, how many people, the kind
 * of place, availability and a few details.
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
  owner?: { id: string; name: string; since?: string };
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const priceText = (l: Pick<MarketListing, "price" | "priceMax">) => `${money(l.price)}${l.priceMax ? `–${money(l.priceMax)}` : ""}/mo`;

/** "Bushwick, Brooklyn, NY 11216": neighborhood, city, state and ZIP, never the street. */
export function placeText(l: Pick<MarketListing, "city" | "state" | "neighborhood" | "zipCode">) {
  const where = [l.neighborhood, l.city].filter(Boolean).join(", ");
  const region = [l.state, l.zipCode].filter(Boolean).join(" ");
  return [where, region].filter(Boolean).join(", ");
}

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

function Photo({ l, className, showNew = true }: { l: MarketListing; className: string; showNew?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}>
      {l.photos[0] ? (
        // Listing photos are user uploads served by nginx, like elsewhere in the app
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.photos[0].url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>
      )}
      {showNew && isNew(l.createdAt) && <span className="absolute left-2.5 top-2.5 rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">New</span>}
      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-sm font-bold text-white">{priceText(l)}</span>
      {l.photos.length > 1 && (
        <span className="absolute bottom-3.5 right-3 flex gap-1" aria-hidden>
          {l.photos.slice(0, 3).map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/60"}`} />)}
        </span>
      )}
    </div>
  );
}

function Facts({ l, compact }: { l: MarketListing; compact: boolean }) {
  const kind = placeKind(l);
  return (
    <p className={`flex flex-wrap items-center gap-y-1 text-gray-600 dark:text-gray-300 ${compact ? "gap-x-2.5 text-xs" : "gap-x-3 text-[13px]"}`}>
      {l.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedIcon className="h-4 w-4" />{l.bedrooms === 0 ? "Studio" : compact ? `${l.bedrooms} bd` : `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}`}</span>}
      {l.bathrooms !== null && <span className="inline-flex items-center gap-1"><BathIcon className="h-4 w-4" />{compact ? `${l.bathrooms} ba` : `${l.bathrooms} bathroom${l.bathrooms === 1 ? "" : "s"}`}</span>}
      {l.maxOccupants ? <span className="inline-flex items-center gap-1"><UsersIcon className="h-4 w-4" />{compact ? `Max ${l.maxOccupants}` : `Up to ${l.maxOccupants} ${l.maxOccupants === 1 ? "person" : "people"}`}</span> : null}
      <span className="inline-flex items-center gap-1"><BuildingIcon className="h-4 w-4" />{kind}</span>
    </p>
  );
}

function Chips({ l, max }: { l: MarketListing; max: number }) {
  const chips = amenityLabels(l).slice(0, max);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(c => <span key={c} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">{c}</span>)}
    </div>
  );
}

function Unavailable({ status }: { status?: string }) {
  if (!status || status === "APPROVED") return null;
  return <span className="inline-block rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">No longer available</span>;
}

/** A row on phones (photo left), as in the mockup; `grid` is the tile for desktop and Home. */
export default function ListingCard({ listing: l, layout = "row", footer }: {
  listing: MarketListing; layout?: "row" | "grid" | "tile"; footer?: React.ReactNode;
}) {
  const gone = !!l.status && l.status !== "APPROVED";
  const available = availableText(l.availableFrom);
  const place = placeText(l);

  if (layout === "tile") {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Link href={`/listings/${l.id}`} className="block">
          <Photo l={l} className="aspect-[4/3]" showNew={false} />
          <div className="space-y-1 p-3">
            <h3 className="truncate text-[15px] font-semibold text-gray-900 group-hover:text-brand dark:text-white">{l.title}</h3>
            <p className="flex items-center gap-1 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{[l.city, l.state].filter(Boolean).join(", ")}</p>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
              {l.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedIcon className="h-3.5 w-3.5" />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}</span>}
              {l.bathrooms !== null && <span className="inline-flex items-center gap-1"><BathIcon className="h-3.5 w-3.5" />{l.bathrooms} ba</span>}
              {available && <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{available}</span>}
            </p>
          </div>
        </Link>
        <SaveButton listingId={l.id} className="absolute right-2.5 top-2.5" />
      </article>
    );
  }

  if (layout === "grid") {
    return (
      <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg hover:shadow-black/5 dark:border-gray-800 dark:bg-gray-900 ${gone ? "opacity-70" : ""}`}>
        <Link href={`/listings/${l.id}`} className="flex flex-1 flex-col">
          <Photo l={l} className="aspect-[4/3]" />
          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <Unavailable status={l.status} />
            <h3 className="truncate font-semibold text-gray-900 group-hover:text-brand dark:text-white">{l.title}</h3>
            {place && <p className="flex items-center gap-1.5 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{place}</p>}
            <Facts l={l} compact />
            {available && <p className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-300"><CalendarIcon className="h-4 w-4" />{available}</p>}
            <div className="mt-1"><Chips l={l} max={3} /></div>
            {l.owner && (
              <p className="mt-auto flex items-center justify-between pt-3 text-xs text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">{l.owner.name[0]?.toUpperCase()}</span>
                  {l.owner.name}
                </span>
                <span>{postedAgo(l.createdAt)}</span>
              </p>
            )}
          </div>
        </Link>
        {!gone && <SaveButton listingId={l.id} className="absolute right-3 top-3" />}
        {footer}
      </article>
    );
  }

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${gone ? "opacity-70" : ""}`}>
      <Link href={`/listings/${l.id}`} className="grid grid-cols-[42%_1fr] gap-3 p-2.5 sm:grid-cols-[38%_1fr]">
        <Photo l={l} className="min-h-[9.5rem] rounded-xl" />
        <div className="min-w-0 space-y-1.5 py-1 pr-9">
          <Unavailable status={l.status} />
          <h3 className="line-clamp-2 font-semibold leading-snug text-gray-900 dark:text-white">{l.title}</h3>
          {place && <p className="flex items-center gap-1.5 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{place}</p>}
          <Facts l={l} compact />
          {available && <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"><CalendarIcon className="h-4 w-4" />{available}</p>}
          <Chips l={l} max={2} />
        </div>
      </Link>
      {!gone && <SaveButton listingId={l.id} onImage={false} className="absolute right-2 top-2.5" />}
      {footer}
    </article>
  );
}
