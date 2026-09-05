"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Listing {
  id: string; type: string; title: string; price: number; priceMax: number | null;
  city: string; state: string | null; bedrooms: number | null; bathrooms: number | null;
  roommateGenderPref: string | null; roommateSmoking: string | null; roommatePets: string | null;
  photos: { url: string }[];
  owner: { id: string; name: string };
  createdAt: string;
}

function BedIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 18v2m0-2h18m0 0v2M5 10V6a2 2 0 012-2h2a2 2 0 012 2v4" />
    </svg>
  );
}
function BathIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M6 12V5a1 1 0 011-1h2a1 1 0 011 1v1M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6" />
    </svg>
  );
}

const TYPE_LABELS: Record<string, string> = { APARTMENT_FOR_RENT: "Apartment for rent", ROOM_TO_SHARE: "Room to share" };

function priceLabel(price: number, priceMax: number | null) {
  return priceMax ? `$${price.toLocaleString()}–$${priceMax.toLocaleString()}/mo` : `$${price.toLocaleString()}/mo`;
}

export default function BrowseListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", city: "", minPrice: "", maxPrice: "", bedrooms: "" });
  const [showFilters, setShowFilters] = useState(false);

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
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Find a place, no broker fee</h1>
        <p className="text-sm text-gray-500 mt-1">Browse apartments and rooms posted directly by the people who have them.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(); }} className="mb-3">
        <div className="relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by city, title, or keyword" value={filters.city}
            onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
            className="w-full border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </form>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button type="button" onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${showFilters || filters.type || filters.minPrice || filters.maxPrice || filters.bedrooms ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12M10 20h4" />
          </svg>
          Filters
        </button>
        {filters.type && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABELS[filters.type]}</span>
        )}
        {(filters.minPrice || filters.maxPrice) && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
            {filters.minPrice ? `$${filters.minPrice}` : "$0"}–{filters.maxPrice ? `$${filters.maxPrice}` : "any"}
          </span>
        )}
        {filters.bedrooms && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{filters.bedrooms} bd</span>
        )}
        <span className="text-xs text-gray-400 ml-auto">{loading ? "…" : `${listings.length} listing${listings.length === 1 ? "" : "s"} found`}</span>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2 sm:col-span-1">
            <option value="">Any type</option>
            <option value="APARTMENT_FOR_RENT">Apartment for rent</option>
            <option value="ROOM_TO_SHARE">Room to share</option>
          </select>
          <input type="number" placeholder="Min $" value={filters.minPrice}
            onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" placeholder="Max $" value={filters.maxPrice}
            onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" placeholder="Bedrooms" value={filters.bedrooms}
            onChange={e => setFilters(f => ({ ...f, bedrooms: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={load} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-16">Loading listings…</p>
      ) : listings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium mb-1">No listings match yet</p>
          <p className="text-sm text-gray-400 mb-5">Be the first to post one, or check back soon.</p>
          <Link href="/listings/new" className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Post a listing
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(l => {
            const isNew = Date.now() - new Date(l.createdAt).getTime() < 3 * 24 * 60 * 60 * 1000;
            return (
            <Link key={l.id} href={`/listings/${l.id}`}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="aspect-[4/3] bg-gray-100 relative">
                {isNew && (
                  <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md z-10">New</span>
                )}
                {l.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0].url} alt={l.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🏠</div>
                )}
              </div>
              <div className="p-4">
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">{TYPE_LABELS[l.type]}</span>
                <p className="font-semibold text-gray-900 mt-0.5 truncate">{l.title}</p>
                <p className="text-sm text-gray-500">{l.city}{l.state ? `, ${l.state}` : ""}</p>
                {(l.bedrooms !== null || l.bathrooms !== null) && (
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {l.bedrooms !== null && <span className="flex items-center gap-1"><BedIcon />{l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}</span>}
                    {l.bathrooms !== null && <span className="flex items-center gap-1"><BathIcon />{l.bathrooms} ba</span>}
                  </div>
                )}
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
            );
          })}
        </div>
      )}
    </main>
  );
}
