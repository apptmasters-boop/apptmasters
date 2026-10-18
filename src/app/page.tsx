"use client";
/**
 * Home (Sprint 12, look matched to docs/mockups/home-mobile.jpg in Sprint 13b;
 * MARKETPLACE_FLOW.md §3, §13, §21). Public: visitors get the landing page
 * with the search. Someone signed in without a home gets their Home: search,
 * quick pickers, Create / Join a Home and listings from their last search (or
 * the latest). People with a home (or a portal, or a home being set up) go
 * where they belong.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { landingPath } from "@/lib/housing";
import { activeChips, parseFilters, EMPTY_FILTERS, filtersToParams } from "@/lib/listingSearch";
import { MarketShell } from "@/components/market/MarketChrome";
import { useMe } from "@/components/market/useMe";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import QuickPickers from "@/components/market/QuickPickers";
import SearchPanel from "@/components/landing/SearchPanel";
import { SectionHeading, SafetySection, CtaBand } from "@/components/landing/Sections";
import HomeQuestionCard from "./listings/_components/HomeQuestionCard";
import {
  ArrowRightIcon, ChevronRightIcon, HomeIcon, HomeUsersIcon, MessageIcon, PlusCircleIcon, SearchIcon, UsersIcon,
} from "@/components/landing/icons";

async function fetchListings(query: string, count: number): Promise<MarketListing[]> {
  const res = await fetch(`/api/listings/search${query}`).catch(() => null);
  const data = res?.ok ? await res.json() : { listings: [] };
  return data.listings.slice(0, count);
}

/** Listings for Home: the last search of this visit when it found any, otherwise the latest. */
function useHomeListings(lastSearch: string, count: number) {
  const [state, setState] = useState<{ listings: MarketListing[]; fromSearch: boolean } | null>(null);
  useEffect(() => {
    let current = true;
    async function load() {
      const found = lastSearch ? await fetchListings(lastSearch, count) : [];
      const result = found.length > 0
        ? { listings: found, fromSearch: true }
        : { listings: await fetchListings("", count), fromSearch: false };
      if (current) setState(result);
    }
    load();
    return () => { current = false; };
  }, [lastSearch, count]);
  return state;
}

function Tiles({ listings }: { listings: MarketListing[] | null }) {
  if (listings === null) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
    );
  }
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
        <p className="font-medium text-gray-700 dark:text-gray-200">No listings yet</p>
        <p className="mt-1 text-sm text-gray-500">Be the first to post an apartment or a room to share.</p>
        <Link href="/listings/new" className="mt-5 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Post a listing</Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {listings.map(l => <ListingCard key={l.id} listing={l} layout="tile" />)}
    </div>
  );
}

function VisitorLatest() {
  const state = useHomeListings("", 8);
  return (
    <section>
      <SectionHeading title="Latest listings" subtitle="Every listing is reviewed before it goes live." link={{ href: "/listings", label: "See all" }} />
      <Tiles listings={state?.listings ?? null} />
    </section>
  );
}

/** "Based on your last search" (this visit's, saved by Find a Home) or "Latest listings". */
function SeekerListings({ lastSearch }: { lastSearch: string }) {
  const state = useHomeListings(lastSearch, 8);
  const fromSearch = !!state?.fromSearch;
  const about = fromSearch ? activeChips(parseFilters(new URLSearchParams(lastSearch))).map(c => c.label).slice(0, 3).join(" · ") : "";
  return (
    <section aria-labelledby="home-listings">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="home-listings" className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
            {fromSearch ? "Based on your last search" : "Latest listings"}
          </h2>
          {about && <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{about}</p>}
        </div>
        <Link href={fromSearch ? `/listings${lastSearch}` : "/listings"}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
          See all<ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <Tiles listings={state?.listings ?? null} />
    </section>
  );
}

const STEPS = [
  { icon: SearchIcon, title: "Find", text: "Search apartments, rooms and shared housing." },
  { icon: MessageIcon, title: "Connect", text: "Contact the advertiser." },
  { icon: HomeIcon, title: "Move in", text: "Sign the lease and pay outside ApptMasters." },
  { icon: UsersIcon, title: "Manage together", text: "Create or join a Home with your roommates." },
];

function VisitorHome() {
  return (
    <>
      {/* Opened from the "Have you found your new home?" email while signed out: sign in to answer. */}
      <div className="mx-auto max-w-[96rem] px-4 pt-4 empty:hidden sm:px-6 lg:px-8"><HomeQuestionCard /></div>
      <section className="bg-gray-50 pb-2 dark:bg-gray-950">
        <div className="relative h-[300px] sm:h-[340px] md:h-[420px]">
          <Image src="/landing/hero.png" alt="Housemates talking in a bright city apartment" fill sizes="100vw"
            loading="eager" fetchPriority="high" className="object-cover object-[50%_58%] md:object-[50%_45%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/5" />
          <div className="relative mx-auto max-w-[96rem] px-4 pt-8 text-white sm:px-6 md:pt-14 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/85 sm:text-xs">ApptMasters</p>
            <h1 className="mt-3 max-w-[15ch] text-3xl font-bold leading-[1.1] sm:text-4xl md:text-5xl">Find a safe place with people you can trust.</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
              Browse apartments and rooms posted directly by the people who have them. No account needed to look.
            </p>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-8 max-w-[96rem] px-4 sm:px-6 md:-mt-20 lg:px-8">
          <SearchPanel />
        </div>
      </section>

      <main className="mx-auto max-w-[96rem] space-y-12 px-4 pb-10 pt-6 sm:px-6 md:space-y-16 md:pb-14 md:pt-8 lg:px-8">
        <VisitorLatest />

        {/* People who found a place elsewhere have a way in too (step O1, owner 2026-10-18). */}
        <div className="lg:max-w-2xl"><AlreadyHavePlace /></div>

        <section>
          <SectionHeading title="How it works" subtitle="From finding a place to living well together." link={{ href: "/how-it-works", label: "Learn more" }} />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><Icon className="h-5 w-5" /></span>
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">{i + 1}. {title}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <SafetySection />
      </main>
      <CtaBand />
    </>
  );
}

/** "Already have a place?" (docs/mockups/home-mobile.jpg). */
function AlreadyHavePlace() {
  return (
    <section className="rounded-2xl border border-brand/15 bg-brand-soft/40 p-4 sm:p-5 dark:border-brand/30 dark:bg-brand/15">
      <Link href="/how-it-works" className="group flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200">
          <HomeUsersIcon className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Already have a place?</h2>
          <span className="mt-1 block text-sm leading-snug text-gray-600 dark:text-gray-300">
            Create a new household or join an existing one to manage your home with your roommates.
          </span>
        </span>
        <ChevronRightIcon className="mt-4 h-5 w-5 shrink-0 text-gray-500 group-hover:text-brand" />
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/apartment/create" className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-brand bg-white py-3 text-sm font-semibold text-brand hover:bg-brand-soft/50 dark:bg-transparent dark:text-emerald-300">
          <PlusCircleIcon className="h-5 w-5" />Create a home
        </Link>
        <Link href="/apartment/join" className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
          <UsersIcon className="h-5 w-5" />Join a home
        </Link>
      </div>
    </section>
  );
}

function SeekerHome() {
  const router = useRouter();
  const [q, setQ] = useState("");
  // The last Find a Home search of this visit ("" when none); read after the first render.
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => {
      let last = "";
      try { last = sessionStorage.getItem("am:lastSearch") ?? ""; } catch { /* storage blocked */ }
      if (current) setLastSearch(last);
    });
    return () => { current = false; };
  }, []);

  return (
    <main className="mx-auto max-w-[96rem] space-y-8 px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-10">
      <HomeQuestionCard />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-12">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl dark:text-white">Find your next home</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-gray-600 sm:text-base dark:text-gray-300">
            Browse apartments and rooms posted directly by the people who have them.
          </p>
          <form onSubmit={e => { e.preventDefault(); router.push(q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}` : "/listings"); }}
            className="mt-5 flex max-w-2xl items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 dark:border-gray-700 dark:bg-gray-900">
            <SearchIcon className="h-6 w-6 shrink-0 text-gray-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="City, neighborhood, or ZIP code" aria-label="City, neighborhood, or ZIP code"
              className="min-w-0 flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white" />
            <button type="submit" className="hidden rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:block">Search</button>
          </form>
          <QuickPickers pickers={["price", "bedrooms", "moveIn"]} filters={{ ...EMPTY_FILTERS, q: q.trim() }}
            filtersHref={q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}&panel=1` : "/listings?panel=1"}
            onPick={patch => {
              const query = filtersToParams({ ...EMPTY_FILTERS, q: q.trim(), ...patch }).toString();
              router.push(query ? `/listings?${query}` : "/listings");
            }} />
        </div>
        <div className="mt-8 lg:mt-0"><AlreadyHavePlace /></div>
      </div>

      {lastSearch === null ? <Tiles listings={null} /> : <SeekerListings lastSearch={lastSearch} />}

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Have a room to share or a place to rent? <Link href="/listings/new" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline dark:text-emerald-300">Post a listing<ArrowRightIcon className="h-4 w-4" /></Link>
      </p>
    </main>
  );
}

export default function Home() {
  const router = useRouter();
  const me = useMe();
  // People with a home, a portal, a home being set up or a join request waiting go where they belong.
  const elsewhere = me ? landingPath(me) : null;
  useEffect(() => { if (elsewhere && elsewhere !== "/") router.replace(elsewhere); }, [elsewhere, router]);

  if (me === undefined || (elsewhere && elsewhere !== "/")) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400 dark:bg-gray-950">Loading…</div>;
  }
  return <MarketShell>{me ? <SeekerHome /> : <VisitorHome />}</MarketShell>;
}
