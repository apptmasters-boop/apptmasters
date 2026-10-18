"use client";
/**
 * A listing (Sprint 12, look matched to the picture in Sprint 13e;
 * MARKETPLACE_FLOW.md §9–§11, §18, §19; design
 * docs/mockups/listing-details-mobile.jpg). Public. Save and Contact need an
 * account: a visitor signs up (or in) and comes back here with the action
 * finished or continued. The street address is never shown here (shared in the
 * conversation); "verified" badges only for checks that really happen (§19).
 * Phones: the photo across the top, Save / Contact pinned at the bottom.
 * Desktop: photos and details on the left, a card that stays in view on the right.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";
import { useMe } from "@/components/market/useMe";
import { BackLink } from "@/components/market/MarketChrome";
import { SaveButton, priceText, availableText, type MarketListing } from "@/components/market/ListingCard";
import { useSavedIds, toggleSaved, saveSignInPath } from "@/components/market/saved";
import { amenityIcon } from "@/components/market/amenityIcons";
import { amenityLabels, placeKind, leaseLabel, feeLabel, laundryLabel } from "@/lib/listingFields";
import {
  ArrowLeftIcon, BathIcon, BedIcon, BuildingIcon, CalendarIcon, CheckIcon, ChevronRightIcon, HeartIcon, HomeIcon, MessageIcon,
  PinIcon, RulerIcon, ShareIcon, UsersIcon,
} from "@/components/landing/icons";

interface ListingDetail extends MarketListing {
  description: string;
  address?: string | null;
  leaseLength: string | null;
  roommateGenderPref: string | null; roommateAgeMin: number | null; roommateAgeMax: number | null;
  roommateOccupation: string | null; roommateSmoking: string | null; roommatePets: string | null;
  roommateLifestyleTags: string; roommateCulturalNotes: string | null;
  owner: { id: string; name: string; createdAt?: string; photo?: string | null };
}

const REPORT_REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam" },
  { value: "BROKER_FEE_DEMANDED", label: "An undisclosed fee was demanded" },
  { value: "ALREADY_RENTED", label: "Already rented / stale" },
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "OTHER", label: "Other" },
];
const AMENITIES_SHOWN = 8;

/** One cell of the facts grid (3 columns, lines between the rows). */
function Fact({ icon: Icon, children }: { icon: (p: { className?: string }) => React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-gray-100 py-3 text-sm leading-tight text-gray-800 sm:text-[15px] dark:border-gray-800 dark:text-gray-200">
      <Icon className="h-5 w-5 shrink-0 text-gray-500" /><span className="min-w-0">{children}</span>
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

/**
 * A listing that closed after you wrote about it (listing lifecycle L1, 2026-10-18): what it
 * was, that it's gone, your conversation, and similar places. The server sends only a summary.
 */
function ClosedListing({ listing, report, reportDialog }: { listing: ListingDetail; report: React.ReactNode; reportDialog: React.ReactNode }) {
  const photo = listing.photos[0]?.url;
  const kind = listing.type === "ROOM_TO_SHARE" ? "room" : listing.propertyType === "HOUSE" ? "house" : "apartment";
  const similar = `/listings?${new URLSearchParams({ q: listing.city, kind })}`;
  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <BackLink href={`/listings/${listing.id}/messages`} label="Back to the conversation" className="mb-2" />
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="aspect-[16/10] bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover opacity-70" /> : <div className="flex h-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>}
        </div>
        <div className="space-y-1.5 p-4">
          <span className="inline-block rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100">No longer available</span>
          <p className="font-semibold text-gray-900 dark:text-white">{listing.title}</p>
          <p className="text-gray-500 dark:text-gray-400">{priceText(listing)} · {[listing.neighborhood, listing.city].filter(Boolean).join(", ")}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        This place isn&apos;t advertised any more. Your conversation with {listing.owner.name.split(" ")[0]} is still there.
      </p>
      <div className="mt-5 space-y-2">
        <Link href={`/listings/${listing.id}/messages`} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
          <MessageIcon className="h-5 w-5" />Open the conversation
        </Link>
        <Link href={similar} className="block rounded-xl border-[1.5px] border-brand py-3 text-center text-sm font-semibold text-brand dark:text-emerald-300">
          Find similar apartments
        </Link>
      </div>
      {/* A scam can still be reported after it closes. */}
      <div className="mt-6">{report}</div>
      {reportDialog}
    </main>
  );
}

function OwnerPhoto({ owner, size }: { owner: ListingDetail["owner"]; size: string }) {
  return owner.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={owner.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200`}>
      {owner.name[0]?.toUpperCase()}
    </span>
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
  const [allAmenities, setAllAmenities] = useState(false);
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
      // "Report this listing" from a conversation opens the report form here (Sprint 13g).
      if (current && new URLSearchParams(window.location.search).get("report") === "1") setReportOpen(true);
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
  const reportDialog = reportOpen && (
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
  );
  if (listing.status === "UNAVAILABLE") {
    return <ClosedListing listing={listing} report={reportMsg ? <p className="text-center text-xs text-gray-500">{reportMsg}</p> : (
      <button type="button" onClick={() => setReportOpen(true)} className="mx-auto block text-xs text-gray-500 hover:text-red-600">Report this listing</button>
    )} reportDialog={reportDialog} />;
  }

  const isOwner = me?.id === listing.owner.id;
  const photos = listing.photos;
  const amenities = amenityLabels(listing);
  const shownAmenities = allAmenities ? amenities : amenities.slice(0, AMENITIES_SHOWN);
  const available = availableText(listing.availableFrom);
  const kind = placeKind(listing);
  const size = listing.squareFeet ? `${listing.squareFeet.toLocaleString("en-US")} sq ft` : null;
  const lifestyleTags: string[] = (() => { try { return JSON.parse(listing.roommateLifestyleTags); } catch { return []; } })();
  const roommatePrefs = listing.type === "ROOM_TO_SHARE" && (listing.roommateGenderPref || listing.roommateAgeMin || listing.roommateAgeMax ||
    listing.roommateOccupation || listing.roommateSmoking || listing.roommatePets || lifestyleTags.length > 0 || listing.roommateCulturalNotes);
  const memberSince = listing.owner.createdAt ? new Date(listing.owner.createdAt).getFullYear() : null;
  const bedroomsText = listing.bedrooms === null ? null : listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}`;
  const bathroomsText = listing.bathrooms === null ? null : `${listing.bathrooms} bathroom${listing.bathrooms === 1 ? "" : "s"}`;
  const peopleText = listing.maxOccupants ? `Max ${listing.maxOccupants} ${listing.maxOccupants === 1 ? "person" : "people"}` : null;
  const terms = [
    ["Lease", leaseLabel(listing.leaseMonths ?? null) ?? listing.leaseLength],
    ["Broker fee", feeLabel("Broker fee", listing.brokerFee ?? null)?.replace(/^Broker fee /, "") ?? null],
    ["Application fee", feeLabel("Application fee", listing.applicationFee ?? null)?.replace(/^Application fee /, "") ?? null],
    ["Laundry", laundryLabel(listing.laundry ?? null)],
    ["Smoking", listing.smokingAllowed === true ? "Allowed" : listing.smokingAllowed === false ? "Not allowed" : null],
  ] as const;

  const actions = isOwner ? (
    <>
      <Link href="/listings/mine" className="flex flex-1 items-center justify-center rounded-xl border-[1.5px] border-brand px-4 py-3 text-base font-semibold text-brand">Manage listing</Link>
      <Link href="/listings/inbox" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white"><MessageIcon className="h-5 w-5" />Messages</Link>
    </>
  ) : (
    <>
      <button type="button" onClick={save} aria-pressed={saved}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-brand bg-white px-4 py-3 text-base font-semibold text-brand hover:bg-brand-soft dark:bg-transparent dark:text-emerald-300">
        <HeartIcon filled={saved} className={`h-5 w-5 ${saved ? "text-red-500" : ""}`} />{saved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={contact} disabled={listing.status !== undefined && listing.status !== "APPROVED"}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
        <MessageIcon className="h-5 w-5" />{contacted ? "Message" : "Contact"}
      </button>
    </>
  );

  return (
    <main className="mx-auto max-w-7xl pb-36 lg:px-8 lg:pb-12 lg:pt-6">
      <Link href={backHref} className="hidden items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 lg:inline-flex dark:text-gray-300">
        <ArrowLeftIcon className="h-4 w-4" />Back to results
      </Link>

      <div className="lg:mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
          {/* Photos: across the top on phones (docs/mockups/listing-details-mobile.jpg). */}
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 sm:aspect-[16/9] lg:aspect-[16/10] lg:rounded-2xl dark:bg-gray-800">
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

          <div className="px-4 pt-5 lg:px-0">
            {listing.status && listing.status !== "APPROVED" && (
              <p className="mb-3 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                {listing.status === "PENDING" ? "Waiting for review: only you can see it" : listing.status === "REJECTED" ? "Not approved: edit it and resubmit" : "No longer available"}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{listing.title}</h1>
            <p className="mt-1 text-2xl font-bold text-brand dark:text-emerald-300">{priceText(listing)}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[15px] text-gray-600 dark:text-gray-300">
              <PinIcon className="h-5 w-5 shrink-0" />{[listing.city, [listing.state, listing.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            </p>

            {/* The facts in 3 columns, as in the picture. */}
            <div className="mt-3 grid grid-cols-3 gap-x-3">
              {bedroomsText && <Fact icon={BedIcon}>{bedroomsText}</Fact>}
              {bathroomsText && <Fact icon={BathIcon}>{bathroomsText}</Fact>}
              {peopleText && <Fact icon={UsersIcon}>{peopleText}</Fact>}
              <Fact icon={BuildingIcon}>{kind}</Fact>
              {size && <Fact icon={RulerIcon}>{size}</Fact>}
              {available && <Fact icon={CalendarIcon}>{available}</Fact>}
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
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Amenities</h2>
                  {amenities.length > AMENITIES_SHOWN && (
                    <button type="button" onClick={() => setAllAmenities(a => !a)} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
                      {allAmenities ? "Show fewer" : `See all ${amenities.length}`}<ChevronRightIcon className={`h-4 w-4 transition-transform ${allAmenities ? "-rotate-90" : ""}`} />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shownAmenities.map(a => {
                    const Icon = amenityIcon(a);
                    return (
                      <span key={a} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                        <Icon className="h-[18px] w-[18px] text-gray-700 dark:text-gray-300" />{a}
                      </span>
                    );
                  })}
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
                <p className="mt-2 text-xs text-gray-500">The lease and payments are arranged with the advertiser, outside ApptMasters.</p>
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

            {/* Where it is, without the street (the map comes with Sprint 12f). */}
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Neighborhood</h2>
              <div className="mt-3 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><PinIcon className="h-6 w-6" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900 dark:text-white">{listing.neighborhood ?? listing.city}</span>
                  <span className="block text-sm text-gray-600 dark:text-gray-300">
                    {[listing.neighborhood ? listing.city : null, [listing.state, listing.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">The exact address is shared by the advertiser in Messages.</span>
                </span>
              </div>
            </section>
          </div>
        </div>

        {/* Desktop: a card that stays in view; on both, the advertiser and Report. */}
        <aside className="mt-6 space-y-4 px-4 lg:sticky lg:top-24 lg:mt-0 lg:px-0">
          <div className="hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:block dark:border-gray-800 dark:bg-gray-900">
            <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{priceText(listing)}</p>
            <p className="mt-0.5 text-sm text-gray-500">{kind}{available ? ` · ${available}` : ""}</p>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
              {bedroomsText && <span className="inline-flex items-center gap-1"><BedIcon className="h-4 w-4" />{bedroomsText}</span>}
              {bathroomsText && <span className="inline-flex items-center gap-1"><BathIcon className="h-4 w-4" />{bathroomsText}</span>}
              {peopleText && <span className="inline-flex items-center gap-1"><UsersIcon className="h-4 w-4" />{peopleText}</span>}
              {size && <span className="inline-flex items-center gap-1"><RulerIcon className="h-4 w-4" />{size}</span>}
            </p>
            <div className="mt-4 flex gap-2">{actions}</div>
            {contacted && !isOwner && <p className="mt-3 text-center text-xs text-gray-500">You&apos;ve already messaged {listing.owner.name.split(" ")[0]} about this place.</p>}
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <OwnerPhoto owner={listing.owner} size="h-16 w-16" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-lg font-semibold text-gray-900 dark:text-white">{listing.owner.name}</span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white" title="Email confirmed"><CheckIcon className="h-3 w-3" /></span>
              </span>
              <span className="block text-sm text-gray-500">Advertiser{memberSince ? ` · Member since ${memberSince}` : ""}</span>
              <span className="mt-0.5 block text-xs text-gray-500">Email confirmed</span>
            </span>
          </div>

          {!isOwner && (
            <div className="px-1">
              {reportMsg ? <p className="text-xs text-gray-500">{reportMsg}</p> : (
                <button type="button" onClick={() => setReportOpen(true)} className="text-xs text-gray-500 hover:text-red-600">Report this listing</button>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-xl gap-3">{actions}</div>
      </div>

      {reportDialog}
    </main>
  );
}
