"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";

interface ListingDetail {
  id: string; type: string; status: string; title: string; description: string;
  price: number; priceMax: number | null; city: string; state: string | null; address: string | null;
  bedrooms: number | null; bathrooms: number | null; availableFrom: string | null; leaseLength: string | null;
  roommateGenderPref: string | null; roommateAgeMin: number | null; roommateAgeMax: number | null;
  roommateOccupation: string | null; roommateSmoking: string | null; roommatePets: string | null;
  roommateLifestyleTags: string; roommateCulturalNotes: string | null;
  photos: { url: string }[];
  owner: { id: string; name: string };
}

const REPORT_REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam" },
  { value: "BROKER_FEE_DEMANDED", label: "Broker fee demanded" },
  { value: "ALREADY_RENTED", label: "Already rented / stale" },
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "OTHER", label: "Other" },
];

function fieldRow(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportNotes, setReportNotes] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [listingRes, meRes] = await Promise.all([
        apiFetch(`/api/listings/${id}`),
        getToken() ? apiFetch("/api/auth/me") : Promise.resolve(null),
      ]);
      if (!listingRes.ok) { setNotFound(true); setLoading(false); return; }
      setListing(await listingRes.json());
      if (meRes?.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
      setLoading(false);
    })();
  }, [id]);

  async function submitReport() {
    setReportSubmitting(true);
    const res = await apiFetch(`/api/listings/${id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason: reportReason, notes: reportNotes || undefined }),
    });
    setReportSubmitting(false);
    if (res.ok) {
      setReportMsg("Thanks — an admin will take a look.");
      setReportOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      setReportMsg(data?.error ?? "Something went wrong");
    }
  }

  function messageOwner() {
    if (!getToken()) {
      router.push(`/listings/signup?returnTo=${encodeURIComponent(`/listings/${id}/messages`)}`);
      return;
    }
    router.push(`/listings/${id}/messages`);
  }

  if (loading) return <main className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;
  if (notFound || !listing) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-700 font-medium mb-1">Listing not found</p>
        <p className="text-sm text-gray-400 mb-5">It may have been removed or isn't public yet.</p>
        <Link href="/listings" className="text-sm text-indigo-600 font-medium hover:underline">← Back to browse</Link>
      </main>
    );
  }

  const isOwner = currentUserId === listing.owner.id;
  const lifestyleTags: string[] = (() => { try { return JSON.parse(listing.roommateLifestyleTags); } catch { return []; } })();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/listings" className="text-sm text-gray-400 hover:text-gray-600">← Back to browse</Link>

      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <div>
          <div className="aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden">
            {listing.photos[activePhoto] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photos[activePhoto].url} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-300">🏠</div>
            )}
          </div>
          {listing.photos.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {listing.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.url} src={p.url} onClick={() => setActivePhoto(i)} alt=""
                  className={`w-16 h-16 rounded-lg object-cover cursor-pointer border-2 flex-shrink-0 ${i === activePhoto ? "border-indigo-500" : "border-transparent"}`} />
              ))}
            </div>
          )}
        </div>

        <div>
          {listing.status !== "APPROVED" && (
            <p className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg inline-block mb-3">
              {listing.status === "PENDING" ? "Pending review — only visible to you" : listing.status}
            </p>
          )}
          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
            {listing.type === "APARTMENT_FOR_RENT" ? "Apartment for rent" : "Room to share"}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{listing.title}</h1>
          <p className="text-gray-500 mt-1">{listing.city}{listing.state ? `, ${listing.state}` : ""}{listing.address ? ` · ${listing.address}` : ""}</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">
            {listing.priceMax ? `$${listing.price.toLocaleString()}–$${listing.priceMax.toLocaleString()}` : `$${listing.price.toLocaleString()}`}
            <span className="text-sm font-normal text-gray-400">/mo</span>
          </p>

          <div className="mt-4">
            {fieldRow("Bedrooms", listing.bedrooms === null ? null : listing.bedrooms === 0 ? "Studio" : String(listing.bedrooms))}
            {fieldRow("Bathrooms", listing.bathrooms === null ? null : String(listing.bathrooms))}
            {fieldRow("Available from", listing.availableFrom ? new Date(listing.availableFrom).toLocaleDateString() : null)}
            {fieldRow("Lease length", listing.leaseLength)}
          </div>

          <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{listing.description}</p>

          {listing.type === "ROOM_TO_SHARE" && (
            listing.roommateGenderPref || listing.roommateAgeMin || listing.roommateAgeMax || listing.roommateOccupation ||
            listing.roommateSmoking || listing.roommatePets || lifestyleTags.length > 0 || listing.roommateCulturalNotes
          ) && (
            <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Roommate they're looking for</p>
              {fieldRow("Gender preference", listing.roommateGenderPref === "ANY" ? "No preference" : listing.roommateGenderPref)}
              {fieldRow("Age range", (listing.roommateAgeMin || listing.roommateAgeMax) ? `${listing.roommateAgeMin ?? "Any"}–${listing.roommateAgeMax ?? "Any"}` : null)}
              {fieldRow("Occupation", listing.roommateOccupation)}
              {fieldRow("Smoking", listing.roommateSmoking === "NO" ? "Non-smoker preferred" : listing.roommateSmoking === "YES" ? "Smoking ok" : listing.roommateSmoking === "EITHER" ? "No preference" : null)}
              {fieldRow("Pets", listing.roommatePets === "NO" ? "No pets" : listing.roommatePets === "YES" ? "Pets ok" : listing.roommatePets === "EITHER" ? "No preference" : null)}
              {lifestyleTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lifestyleTags.map(tag => (
                    <span key={tag} className="text-xs bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
              {listing.roommateCulturalNotes && (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{listing.roommateCulturalNotes}</p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-400 mt-4">Posted by {listing.owner.name}</p>

          <div className="flex gap-2 mt-5">
            {isOwner ? (
              <>
                <Link href="/listings/mine" className="flex-1 text-center bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  Manage this listing
                </Link>
                <Link href="/listings/inbox" className="flex-1 text-center border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Messages
                </Link>
              </>
            ) : (
              <button onClick={messageOwner}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Message {listing.owner.name.split(" ")[0]}
              </button>
            )}
          </div>

          {!isOwner && (
            <div className="mt-3">
              {reportMsg ? (
                <p className="text-xs text-gray-400">{reportMsg}</p>
              ) : (
                <button onClick={() => setReportOpen(true)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Report this listing
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Report this listing</h2>
            <select value={reportReason} onChange={e => setReportReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea placeholder="Details (optional)" value={reportNotes} onChange={e => setReportNotes(e.target.value)}
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-2">
              <button onClick={submitReport} disabled={reportSubmitting}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {reportSubmitting ? "Submitting…" : "Submit report"}
              </button>
              <button onClick={() => setReportOpen(false)} className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
