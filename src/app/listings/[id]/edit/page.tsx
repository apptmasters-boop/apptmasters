"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { BackLink } from "@/components/market/MarketChrome";
import ListingForm, { emptyListingForm, toPayload, detailsToForm, ListingFormData } from "../../_components/ListingForm";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ListingFormData>(emptyListingForm);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  // Relisting a rented listing (listing lifecycle L2, owner 2026-10-18): details kept, photos new.
  const [relisting, setRelisting] = useState(false);
  const [datePassed, setDatePassed] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace(`/signup?returnTo=${encodeURIComponent(`/listings/${id}/edit`)}`); return; }
    (async () => {
      const [listingRes, meRes] = await Promise.all([apiFetch(`/api/listings/${id}`), apiFetch("/api/auth/me")]);
      if (!listingRes.ok || !meRes.ok) { setForbidden(true); setLoading(false); return; }
      const listing = await listingRes.json();
      const me = await meRes.json();
      if (listing.owner.id !== me.id) { setForbidden(true); setLoading(false); return; }
      if (listing.status === "REMOVED") { setForbidden(true); setLoading(false); return; }
      const relist = listing.status === "RENTED";
      // While it was rented its "available from" may have passed: start from Available now (empty).
      const oldDate: string = listing.availableFrom ? listing.availableFrom.slice(0, 10) : "";
      const passed = relist && !!oldDate && oldDate < new Date().toISOString().slice(0, 10);

      setForm({
        ...emptyListingForm,
        type: listing.type,
        title: listing.title,
        description: listing.description,
        price: String(listing.price),
        priceMax: listing.priceMax ? String(listing.priceMax) : "",
        city: listing.city,
        state: listing.state ?? "",
        address: listing.address ?? "",
        bedrooms: listing.bedrooms !== null ? String(listing.bedrooms) : "",
        bathrooms: listing.bathrooms !== null ? String(listing.bathrooms) : "",
        availableFrom: passed ? "" : oldDate,
        leaseLength: listing.leaseLength ?? "",
        roommateGenderPref: listing.roommateGenderPref ?? "",
        roommateAgeMin: listing.roommateAgeMin !== null ? String(listing.roommateAgeMin) : "",
        roommateAgeMax: listing.roommateAgeMax !== null ? String(listing.roommateAgeMax) : "",
        roommateOccupation: listing.roommateOccupation ?? "",
        roommateSmoking: listing.roommateSmoking ?? "",
        roommatePets: listing.roommatePets ?? "",
        roommateLifestyleTags: (() => { try { return JSON.parse(listing.roommateLifestyleTags); } catch { return []; } })(),
        roommateCulturalNotes: listing.roommateCulturalNotes ?? "",
        photoUrls: listing.photos.map((p: { url: string }) => p.url),
        ...detailsToForm(listing), // Find a Home details (Sprint 12)
      });
      setRejectionReason(listing.status === "REJECTED" ? listing.rejectionReason : null);
      setRelisting(relist);
      setDatePassed(passed);
      setLoading(false);
    })();
  }, [id, router]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const res = await apiFetch(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify(toPayload(form)) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    router.push("/listings/mine");
  }

  if (loading) return <main className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;
  if (forbidden) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-gray-600 font-medium mb-1">Can&apos;t edit this listing</p>
        <p className="text-sm text-gray-400">It&apos;s either not yours, or ApptMasters removed it.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-1 flex items-center gap-1">
        <BackLink href="/listings/mine" label="My listings" />
        <h1 className="text-2xl font-bold text-gray-900">{relisting ? "Relist your listing" : "Edit listing"}</h1>
      </div>
      {relisting ? (
        <div className="mb-6 space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p>Everything is filled in from before. <strong>Add photos of the apartment as it is now:</strong> the old ones were deleted when it was rented.</p>
          {datePassed && <p>The old &quot;available from&quot; date has passed: choose a new one, or leave it empty for Available now.</p>}
          <p>It goes to a quick review before it&apos;s back in search.</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-6">Changing most fields sends it back for another quick review.</p>
      )}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ListingForm form={form} setForm={setForm} onSubmit={handleSubmit} submitting={submitting}
          submitLabel={relisting ? "Relist" : "Save changes"} error={error} rejectionReason={rejectionReason} />
      </div>
    </main>
  );
}
