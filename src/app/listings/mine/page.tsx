"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";

interface Listing {
  id: string; type: string; status: string; title: string; price: number; priceMax: number | null;
  city: string; rejectionReason: string | null;
  photos: { url: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  REMOVED: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function MyListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/listings/mine");
    if (res.ok) setListings(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    if (!getToken()) { router.replace("/listings/signup?returnTo=/listings/mine"); return; }
    load();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markRemoved(id: string) {
    if (!confirm("Mark this listing as rented/no longer available? You'll need a new listing to relist.")) return;
    setWorking(id);
    await apiFetch(`/api/listings/${id}`, { method: "PATCH", body: JSON.stringify({ action: "MARK_REMOVED" }) });
    setWorking(null);
    load();
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing permanently? This can't be undone.")) return;
    setWorking(id);
    await apiFetch(`/api/listings/${id}`, { method: "DELETE" });
    setWorking(null);
    load();
  }

  if (loading) return <main className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My listings</h1>
        <Link href="/listings/new" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          + New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🏠</p>
          <p className="text-gray-600 font-medium mb-1">No listings yet</p>
          <p className="text-sm text-gray-400">Post an apartment or a room to share.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => (
            <div key={l.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-4">
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
                {l.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0].url} alt="" className="w-full h-full object-cover" />
                ) : "🏠"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/listings/${l.id}`} className="font-semibold text-gray-900 hover:underline truncate">{l.title}</Link>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                </div>
                <p className="text-sm text-gray-500">{l.city} · ${l.price.toLocaleString()}{l.priceMax ? `–$${l.priceMax.toLocaleString()}` : ""}/mo</p>
                {l.status === "REJECTED" && l.rejectionReason && (
                  <p className="text-xs text-red-600 mt-1">{l.rejectionReason}</p>
                )}
                <div className="flex gap-3 mt-2">
                  {l.status !== "REMOVED" && (
                    <Link href={`/listings/${l.id}/edit`} className="text-xs text-blue-600 font-medium hover:underline">
                      {l.status === "REJECTED" ? "Edit & resubmit" : "Edit"}
                    </Link>
                  )}
                  {l.status !== "REMOVED" && (
                    <button onClick={() => markRemoved(l.id)} disabled={working === l.id} className="text-xs text-gray-500 hover:underline disabled:opacity-50">
                      Mark as rented
                    </button>
                  )}
                  <button onClick={() => deleteListing(l.id)} disabled={working === l.id} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
