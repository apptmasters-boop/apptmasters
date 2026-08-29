"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Listing {
  id: string; type: string; title: string; price: number; priceMax: number | null;
  city: string; state: string | null; bedrooms: number | null;
  roommateGenderPref: string | null; roommateSmoking: string | null; roommatePets: string | null;
  photos: { url: string }[];
  owner: { id: string; name: string };
}

const TYPE_LABELS: Record<string, string> = { APARTMENT_FOR_RENT: "Apartment for rent", ROOM_TO_SHARE: "Room to share" };

function priceLabel(price: number, priceMax: number | null) {
  return priceMax ? `$${price.toLocaleString()}–$${priceMax.toLocaleString()}/mo` : `$${price.toLocaleString()}/mo`;
}

export default function BrowseListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", city: "", minPrice: "", maxPrice: "", bedrooms: "" });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await apiFetch(`/api/listings?${params.toString()}`);
    if (res.ok) setListings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find a place, no broker fee</h1>
        <p className="text-sm text-gray-500 mt-1">Browse apartments and rooms posted directly by the people who have them.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(); }}
        className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 col-span-2 sm:col-span-1">
          <option value="">Any type</option>
          <option value="APARTMENT_FOR_RENT">Apartment for rent</option>
          <option value="ROOM_TO_SHARE">Room to share</option>
        </select>
        <input type="text" placeholder="City" value={filters.city}
          onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="number" placeholder="Min $" value={filters.minPrice}
          onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="number" placeholder="Max $" value={filters.maxPrice}
          onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-16">Loading listings…</p>
      ) : listings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium mb-1">No listings match yet</p>
          <p className="text-sm text-gray-400 mb-5">Be the first to post one, or check back soon.</p>
          <Link href="/listings/new" className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Post a listing
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(l => (
            <Link key={l.id} href={`/listings/${l.id}`}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="aspect-[4/3] bg-gray-100">
                {l.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0].url} alt={l.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🏠</div>
                )}
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-indigo-600 uppercase tracking-wide">{TYPE_LABELS[l.type]}</span>
                <p className="font-semibold text-gray-900 mt-0.5 truncate">{l.title}</p>
                <p className="text-sm text-gray-500">{l.city}{l.state ? `, ${l.state}` : ""}{l.bedrooms !== null ? ` · ${l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}` : ""}</p>
                <p className="font-bold text-gray-900 mt-2">{priceLabel(l.price, l.priceMax)}</p>
                {l.type === "ROOM_TO_SHARE" && (l.roommateGenderPref || l.roommateSmoking || l.roommatePets) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {l.roommateGenderPref && l.roommateGenderPref !== "ANY" && (
                      <span className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {l.roommateGenderPref === "MALE" ? "Male roommate" : "Female roommate"}
                      </span>
                    )}
                    {l.roommateSmoking === "NO" && <span className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Non-smoker</span>}
                    {l.roommatePets === "YES" && <span className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Pets ok</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
