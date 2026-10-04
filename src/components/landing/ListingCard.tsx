import Link from "next/link";
import { BedIcon, BathIcon, CalendarIcon, ShieldCheckIcon, HomeIcon } from "./icons";
import { TYPE_LABELS, LIFESTYLE_OPTIONS } from "./options";

export interface CardListing {
  id: string;
  type: string;
  title: string;
  price: number;
  priceMax: number | null;
  city: string;
  state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  availableFrom: string | null;
  leaseLength: string | null;
  roommateLifestyleTags?: string;
  photos: { url: string }[];
}

const TAG_LABEL = Object.fromEntries(LIFESTYLE_OPTIONS.map(o => [o.value, o.label]));

function parseTags(raw?: string): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t in TAG_LABEL) : [];
  } catch {
    return [];
  }
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function ListingCard({ listing: l }: { listing: CardListing }) {
  const place = [l.city, l.state].filter(Boolean).join(", ");
  const available = l.availableFrom
    ? new Date(l.availableFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : null;
  const tags = l.type === "ROOM_TO_SHARE" ? parseTags(l.roommateLifestyleTags).slice(0, 2) : [];

  return (
    <Link href={`/listings/${l.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg hover:shadow-black/5">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {l.photos[0] ? (
          // Listing photos are user uploads served by nginx, like elsewhere in the app
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.photos[0].url} alt={l.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>
        )}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Reviewed listing
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <p className="text-lg font-bold text-gray-900">
          {money(l.price)}{l.priceMax ? `–${money(l.priceMax)}` : ""}
          <span className="text-xs font-normal text-gray-500"> / month</span>
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-800 group-hover:text-brand">{l.title}</p>
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-medium text-gray-800">{TYPE_LABELS[l.type] ?? "Listing"}</span>
          {place && <> · {place}</>}
        </p>

        {(l.bedrooms !== null || l.bathrooms !== null) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            {l.bedrooms !== null && (
              <span className="inline-flex items-center gap-1"><BedIcon className="h-3.5 w-3.5" />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}`}</span>
            )}
            {l.bathrooms !== null && (
              <span className="inline-flex items-center gap-1"><BathIcon className="h-3.5 w-3.5" />{l.bathrooms} bath{l.bathrooms === 1 ? "" : "s"}</span>
            )}
          </p>
        )}

        {(available || l.leaseLength) && (
          <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
            <CalendarIcon className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{[available && `Available ${available}`, l.leaseLength].filter(Boolean).join(" · ")}</span>
          </p>
        )}

        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {tags.map(t => (
              <span key={t} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand dark:bg-brand/30 dark:text-emerald-200">
                {TAG_LABEL[t]}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
