"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, redirectToApartment } from "@/lib/api";

interface HomeListing {
  id: string; type: string; title: string; price: number; priceMax: number | null;
  city: string; state: string | null;
  photos: { url: string }[];
}

const TYPE_LABELS: Record<string, string> = { APARTMENT_FOR_RENT: "Apartment for rent", ROOM_TO_SHARE: "Room to share" };

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [listings, setListings] = useState<HomeListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      redirectToApartment(router).catch(() => router.replace("/dashboard"));
    } else {
      setRedirecting(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/listings")
      .then(res => res.ok ? res.json() : [])
      .then((data: HomeListing[]) => setListings(data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setListingsLoading(false));
  }, []);

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Checking sign-in status…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 bg-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
          <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-slate-200 shadow-sm shadow-indigo-500/10">
                <span className="font-semibold text-white">Roommate management</span>
                <span className="text-slate-400">made simple</span>
              </div>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Keep your household in sync, without the chaos.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-300">
                  ApptMasters helps roommates share chores, track bills, manage inventory, and stay up to date with notifications — all from one modern home hub.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/register" className="inline-flex items-center justify-center rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400">
                  Create account
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                  Sign in
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/30 ring-1 ring-white/10">
              <div className="space-y-5">
                <div className="rounded-3xl bg-slate-950/80 p-5 shadow-inner shadow-white/5">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Dashboard preview</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      { title: "Chores", value: "keep everyone on schedule" },
                      { title: "Groceries", value: "track items and quantities" },
                      { title: "Rent", value: "share payments evenly" },
                      { title: "Messages", value: "chat with your roommates" },
                    ].map(item => (
                      <div key={item.title} className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-400">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-sm text-slate-400">
                  <p className="font-semibold text-slate-100">Designed for roommates</p>
                  <p className="mt-2">Instantly create or join an apartment, assign chores, manage shared expenses, and stay in sync with push notifications.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="listings" className="border-t border-white/10 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Places posted recently</h2>
              <p className="mt-2 text-slate-400">No broker fee, ever — posted directly by the people who have them.</p>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-indigo-300 hover:text-indigo-200 transition">
              See all listings →
            </Link>
          </div>

          {listingsLoading ? (
            <p className="text-slate-500 text-sm">Loading listings…</p>
          ) : listings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
              <p className="text-slate-300 font-medium mb-1">No listings yet</p>
              <p className="text-sm text-slate-500 mb-5">Be the first to post an apartment or a room to share.</p>
              <Link href="/listings/new" className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
                Post a listing
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map(l => (
                <Link key={l.id} href={`/listings/${l.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition hover:border-indigo-400/40 hover:bg-white/[0.07]">
                  <div className="aspect-[4/3] bg-slate-800">
                    {l.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0].url} alt={l.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600">🏠</div>
                    )}
                  </div>
                  <div className="p-4">
                    <span className="text-[11px] font-medium text-indigo-300 uppercase tracking-wide">{TYPE_LABELS[l.type]}</span>
                    <p className="font-semibold text-white mt-0.5 truncate group-hover:text-indigo-200 transition">{l.title}</p>
                    <p className="text-sm text-slate-400">{l.city}{l.state ? `, ${l.state}` : ""}</p>
                    <p className="font-bold text-white mt-2">
                      ${l.price.toLocaleString()}{l.priceMax ? `–$${l.priceMax.toLocaleString()}` : ""}
                      <span className="text-sm font-normal text-slate-500">/mo</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
