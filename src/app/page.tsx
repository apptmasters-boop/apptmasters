"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, goToLandingPage } from "@/lib/api";
import { SiteHeader, MobileBottomNav } from "@/components/landing/SiteChrome";
import SearchPanel from "@/components/landing/SearchPanel";
import ListingCard, { type CardListing } from "@/components/landing/ListingCard";
import { SectionHeading, CommunityCards, SafetySection, CtaBand } from "@/components/landing/Sections";

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [listings, setListings] = useState<CardListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = getToken();
    } catch {
      // Storage blocked (privacy mode, embedded frame): treat as signed out.
    }
    if (token) {
      goToLandingPage(router).catch(() => router.replace("/dashboard"));
    } else {
      setRedirecting(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/listings")
      .then(res => res.ok ? res.json() : [])
      .then((data: CardListing[]) => setListings(data.slice(0, 4)))
      .catch(() => {})
      .finally(() => setListingsLoading(false));
  }, []);

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16 text-gray-900 md:pb-0">
      <SiteHeader />

      <section className="bg-gray-50 pb-10">
        <div className="relative h-[300px] sm:h-[340px] md:h-[420px]">
          <Image src="/landing/hero.png" alt="Housemates talking in a bright city apartment" fill sizes="100vw"
            loading="eager" fetchPriority="high" className="object-cover object-[50%_58%] md:object-[50%_45%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/5" />
          <div className="relative mx-auto max-w-7xl px-4 pt-8 text-white sm:px-6 md:pt-14 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/85 sm:text-xs">Apartment Masters</p>
            <h1 className="mt-3 max-w-[15ch] text-3xl font-bold leading-[1.1] sm:text-4xl md:text-5xl">
              Find a safe place with people you can trust.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
              Temporary housing. Real community.
              <br />
              A path to your independence.
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 md:-mt-20 lg:px-8">
          <SearchPanel />
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 md:space-y-16 md:py-14 lg:px-8">
        <section>
          <SectionHeading
            title="Featured Listings"
            subtitle="Every listing is reviewed before it goes live."
            link={{ href: "/listings", label: "View all" }}
          />
          {listingsLoading ? (
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <p className="font-medium text-gray-700">No listings yet</p>
              <p className="mt-1 text-sm text-gray-500">Be the first to post an apartment or a room to share.</p>
              <Link href="/listings/new" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                List your space
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:gap-4 lg:grid-cols-4">
              {listings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>

        <CommunityCards />
        <SafetySection />
      </main>

      <CtaBand />
      <MobileBottomNav />
    </div>
  );
}
