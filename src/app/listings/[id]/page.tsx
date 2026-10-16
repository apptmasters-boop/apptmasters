"use client";
/**
 * A listing (Sprint 12; MARKETPLACE_FLOW.md §9–§11, §18, §19; design
 * docs/mockups/listing-details-mobile.jpg). Public. Save and Contact need an
 * account: a visitor signs up (or in) and comes back here with the action
 * finished or continued. The street address is never shown here (shared in the
 * conversation); "verified" badges only for checks that really happen (§19).
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";
import { useMe } from "@/components/market/useMe";
import { SaveButton, priceText, placeText, availableText, type MarketListing } from "@/components/market/ListingCard";
import { useSavedIds, toggleSaved, saveSignInPath } from "@/components/market/saved";
import { amenityLabels, placeKind, leaseLabel, feeLabel, laundryLabel } from "@/lib/listingFields";
import {
  ArrowLeftIcon, BathIcon, BedIcon, BuildingIcon, CalendarIcon, CheckIcon, HeartIcon, HomeIcon, MessageIcon, PinIcon,
  ReceiptIcon, ShareIcon, UsersIcon,
} from "@/components/landing/icons";

interface ListingDetail extends MarketListing {
  description: string;
  address?: string | null;
  leaseLength: string | null;
  roommateGenderPref: string | null; roommateAgeMin: number | null; roommateAgeMax: number | null;
  roommateOccupation: string | null; roommateSmoking: string | null; roommatePets: string | null;
  roommateLifestyleTags: string; roommateCulturalNotes: string | null;
  owner: { id: string; name: string; createdAt?: string };
}

const REPORT_REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam" },
  { value: "BROKER_FEE_DEMANDED", label: "An undisclosed fee was demanded" },
  { value: "ALREADY_RENTED", label: "Already rented / stale" },
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "OTHER", label: "Other" },
];

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-gray-100 py-3 text-[15px] text-gray-800 dark:border-gray-800 dark:text-gray-200">
      <span className="text-gray-500">{icon}</span>{children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5 text-sm last:border-0 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const saved = useSavedIds().has(id);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [moreText, setMoreText] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [backHref, setBackHref] = useState("/listings");
  const [shared, setShared] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    async function load() {
      const res = await apiFetch(`/api/listings/${id}`);
      if (!current) return;
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      if (current) setListing(data);
      // Back to the same search (§12).
      try { const last = sessionStorage.getItem("am:lastSearch"); if (last !== null && current) setBackHref(`/listings${last}`); } catch { /* storage blocked */ }
    }
    load();
    return () => { current = false; };
  }, [id]);

  // Saved and Contacted are different things (§18): show if you've already written about this listing.
  useEffect(() => {
    if (!me) return;
    let current = true;
    async function load() {
      const res = await apiFetch("/api/listings/inbox").catch(() => null);
      if (!res?.ok) return;
      const conversations: { listingId: string; myListing: boolean }[] = await res.json();
      if (current) setContacted(conversations.some(c => c.listingId === id && !c.myListing));
    }
    load();
    return () => { current = false; };
  }, [me, id]);

  function contact() {
    if (!getToken()) { router.push(`/signup?returnTo=${encodeURIComponent(`/listings/${id}/messages`)}`); return; }
    router.push(`/listings/${id}/messages`);
  }
  function save() {
    if (me === null) router.push(saveSignInPath(id));
    else if (me) toggleSaved(id);
  }
  async function share() {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: listing?.title, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* the person closed the share sheet */ }
  }
  async function submitReport() {
    setReportSubmitting(true);
    const res = await apiFetch(`/api/listings/${id}/report`, { method: "POST", body: JSON.stringify({ reason: reportReason, notes: reportNotes || undefined }) });
    setReportSubmitting(false);
    if (res.ok) { setReportMsg("Thanks: an admin will take a look."); setReportOpen(false); }
    else setReportMsg((await res.json().catch(() => null))?.error ?? "Something went wrong");
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <HomeIcon className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 font-semibold text-gray-800 dark:text-white">Listing not found</p>
        <p className="mt-1 text-sm text-gray-500">It may have been removed or isn&apos;t public yet.</p>
        <Link href="/listings" className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">Back to Find a Home</Link>
      </main>
    );
  }
  if (!listing) return <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-gray-400">Loading…</main>;

  const isOwner = me?.id === listing.owner.id;
  const photos = listing.photos;
  const amenities = amenityLabels(listing);
  const available = availableText(listing.availableFrom);
  const lifestyleTags: string[] = (() => { try { return JSON.parse(listing.roommateLifestyleTags); } catch { return []; } })();
  const roommatePrefs = listing.type === "ROOM_TO_SHARE" && (listing.roommateGenderPref || listing.roommateAgeMin || listing.roommateAgeMax ||
    listing.roommateOccupation || listing.roommateSmoking || listing.roommatePets || lifestyleTags.length > 0 || listing.roommateCulturalNotes);
  const memberSince = listing.owner.createdAt ? new Date(listing.owner.createdAt).getFullYear() : null;
  const terms = [
    ["Lease", leaseLabel(listing.leaseMonths ?? null) ?? listing.leaseLength],
    ["Broker fee", feeLabel("Broker fee", listing.brokerFee ?? null)?.replace(/^Broker fee /, "") ?? null],
    ["Application fee", feeLabel("Application fee", listing.applicationFee ?? null)?.replace(/^Application fee /, "") ?? null],
    ["Laundry", laundryLabel(listing.laundry ?? null)],
    ["Smoking", listing.smokingAllowed === true ? "Allowed" : listing.smokingAllowed === false ? "Not allowed" : null],
  ] as const;

  const actions = isOwner ? (
    <>
      <Link href="/listings/mine" className="flex flex-1 items-center justify-center rounded-xl border-2 border-brand px-4 py-3 text-base font-semibold text-brand">Manage listing</Link>
      <Link href="/listings/inbox" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white"><MessageIcon className="h-5 w-5" />Messages</Link>
    </>
  ) : (
    <>
      <button type="button" onClick={save} aria-pressed={saved}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 py-3 text-base font-semibold text-brand hover:bg-brand-soft dark:text-emerald-300">
        <HeartIcon filled={saved} className={`h-5 w-5 ${saved ? "text-red-500" : ""}`} />{saved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={contact} disabled={listing.status !== undefined && listing.status !== "APPROVED"}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
        <MessageIcon className="h-5 w-5" />{contacted ? "Message" : "Contact"}
      </button>
    </>
  );

  return (
    <main className="mx-auto max-w-6xl pb-36 lg:px-8 lg:pb-12 lg:pt-6">
      <Link href={backHref} className="hidden items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 lg:inline-flex dark:text-gray-300">
        <ArrowLeftIcon className="h-4 w-4" />Back to results
      </Link>

      {/* Photos */}
      <div className="relative lg:mt-4">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 sm:aspect-[16/9] lg:aspect-[21/9] lg:rounded-2xl dark:bg-gray-800">
          {photos[photo] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[photo].url} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300"><HomeIcon className="h-14 w-14" /></div>
          )}
          {photos.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white">{photo + 1} / {photos.length}</span>
          )}
        </div>
        <Link href={backHref} aria-label="Back to results" className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow lg:hidden">
          <ArrowLeftIcon className="h-6 w-6 text-gray-900" />
        </Link>
        <div className="absolute right-3 top-3 flex gap-2">
          {!isOwner && <SaveButton listingId={id} large />}
          <button type="button" onClick={share} aria-label="Share" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
            <ShareIcon className="h-5 w-5 text-gray-900" />
          </button>
        </div>
        {shared && <span className="absolute right-3 top-16 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">Link copied</span>}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 lg:px-0">
          {photos.map((p, i) => (
            <button key={i} type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-28 ${i === photo ? "border-brand" : "border-transparent opacity-80"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-5 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-10 lg:px-0">
        <div className="min-w-0">
          {listing.status && listing.status !== "APPROVED" && (
            <p className="mb-3 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              {listing.status === "PENDING" ? "Waiting for review: only you can see it" : listing.status === "REJECTED" ? "Not approved: edit it and resubmit" : "No longer available"}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{listing.title}</h1>
          <p className="mt-1 text-2xl font-bold text-brand dark:text-emerald-300">{priceText(listing)}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[15px] text-gray-600 dark:text-gray-300"><PinIcon className="h-5 w-5 shrink-0" />{placeText(listing)}</p>

          <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {listing.bedrooms !== null && <Fact icon={<BedIcon className="h-5 w-5" />}>{listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}`}</Fact>}
            {listing.bathrooms !== null && <Fact icon={<BathIcon className="h-5 w-5" />}>{listing.bathrooms} bathroom{listing.bathrooms === 1 ? "" : "s"}</Fact>}
            {listing.maxOccupants ? <Fact icon={<UsersIcon className="h-5 w-5" />}>Max {listing.maxOccupants} {listing.maxOccupants === 1 ? "person" : "people"}</Fact> : null}
            <Fact icon={<BuildingIcon className="h-5 w-5" />}>{placeKind(listing)}</Fact>
            {available && <Fact icon={<CalendarIcon className="h-5 w-5" />}>{available}</Fact>}
            {(listing.leaseMonths !== null && listing.leaseMonths !== undefined) && <Fact icon={<ReceiptIcon className="h-5 w-5" />}>{leaseLabel(listing.leaseMonths)}</Fact>}
          </div>

          {listing.maxOccupants && listing.maxOccupants > 1 && listing.type === "APARTMENT_FOR_RENT" ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 dark:bg-brand/15">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand dark:bg-brand/30 dark:text-emerald-200"><UsersIcon className="h-6 w-6" /></span>
              <span>
                <span className="block font-semibold text-gray-900 dark:text-white">Looking for a place with roommates?</span>
                <span className="block text-sm text-gray-600 dark:text-gray-300">This place can fit up to {listing.maxOccupants} people.</span>
              </span>
            </div>
          ) : null}

          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">What&apos;s included</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {amenities.map(a => (
                  <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                    <CheckIcon className="h-4 w-4 text-brand" />{a}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Description</h2>
            <p className={`mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 ${moreText ? "" : "line-clamp-4"}`}>{listing.description}</p>
            {listing.description.length > 220 && (
              <button type="button" onClick={() => setMoreText(m => !m)} className="mt-1 text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
                {moreText ? "Show less" : "Show more"}
              </button>
            )}
          </section>

          {terms.some(([, v]) => v) && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lease and fees</h2>
              <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-1 dark:border-gray-800 dark:bg-gray-900">
                {terms.map(([label, value]) => <Row key={label} label={label} value={value} />)}
              </div>
              <p className="mt-2 text-xs text-gray-500">The lease and payments are arranged with the advertiser, outside Apartment Masters.</p>
            </section>
          )}

          {roommatePrefs && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">The roommate they&apos;re looking for</h2>
              <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-1 dark:border-gray-800 dark:bg-gray-900">
                <Row label="Gender" value={listing.roommateGenderPref === "ANY" ? "No preference" : listing.roommateGenderPref === "MALE" ? "Male" : listing.roommateGenderPref === "FEMALE" ? "Female" : null} />
                <Row label="Age" value={listing.roommateAgeMin || listing.roommateAgeMax ? `${listing.roommateAgeMin ?? "Any"}–${listing.roommateAgeMax ?? "Any"}` : null} />
                <Row label="Occupation" value={listing.roommateOccupation === "STUDENT" ? "Student" : listing.roommateOccupation === "PROFESSIONAL" ? "Working professional" : listing.roommateOccupation === "EITHER" ? "Either" : null} />
                <Row label="Smoking" value={listing.roommateSmoking === "NO" ? "Non-smoker preferred" : listing.roommateSmoking === "YES" ? "Smoking ok" : null} />
                <Row label="Pets" value={listing.roommatePets === "NO" ? "No pets" : listing.roommatePets === "YES" ? "Pets ok" : null} />
                {lifestyleTags.length > 0 && <Row label="Lifestyle" value={lifestyleTags.map(t => t.replace(/-/g, " ")).join(", ")} />}
              </div>
              {listing.roommateCulturalNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{listing.roommateCulturalNotes}</p>}
            </section>
          )}

          {listing.neighborhood && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Neighborhood</h2>
              <p className="mt-1 text-[15px] text-gray-700 dark:text-gray-300">{[listing.neighborhood, listing.city].join(", ")}</p>
              <p className="mt-1 text-xs text-gray-500">The exact address is shared by the advertiser in Messages.</p>
            </section>
          )}
        </div>

        {/* The advertiser, and Save / Contact (a side card on desktop, a bar on phones). */}
        <aside className="mt-6 lg:mt-0">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="hidden rounded-2xl border border-gray-200 bg-white p-5 lg:block dark:border-gray-800 dark:bg-gray-900">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{priceText(listing)}</p>
              <p className="text-sm text-gray-500">{placeKind(listing)}{available ? ` · ${available}` : ""}</p>
              <div className="mt-4 flex gap-2">{actions}</div>
              {contacted && !isOwner && <p className="mt-3 text-center text-xs text-gray-500">You&apos;ve already messaged {listing.owner.name.split(" ")[0]} about this place.</p>}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">
                {listing.owner.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-900 dark:text-white">{listing.owner.name}</span>
                <span className="block text-sm text-gray-500">Advertiser{memberSince ? ` · Member since ${memberSince}` : ""}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><CheckIcon className="h-3.5 w-3.5 text-brand" />Email confirmed</span>
              </span>
            </div>
            {!isOwner && (
              <div className="px-1">
                {reportMsg ? <p className="text-xs text-gray-500">{reportMsg}</p> : (
                  <button type="button" onClick={() => setReportOpen(true)} className="text-xs text-gray-500 hover:text-red-600">Report this listing</button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-xl gap-3">{actions}</div>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-label="Report this listing">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="font-bold text-gray-900 dark:text-white">Report this listing</h2>
            <select value={reportReason} onChange={e => setReportReason(e.target.value)} aria-label="Reason"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950">
              {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea placeholder="Details (optional)" value={reportNotes} onChange={e => setReportNotes(e.target.value)} rows={3}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
            <div className="flex gap-2">
              <button type="button" onClick={submitReport} disabled={reportSubmitting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {reportSubmitting ? "Sending…" : "Send report"}
              </button>
              <button type="button" onClick={() => setReportOpen(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
