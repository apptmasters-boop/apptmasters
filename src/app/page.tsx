"use client";
/**
 * Home (Sprint 12; MARKETPLACE_FLOW.md §3, §13, §21; design
 * docs/mockups/home-mobile.jpg). Public: visitors get the landing page with
 * the search. Someone signed in without a home gets their Home: search, quick
 * filters, Create / Join a Home and the latest listings. People with a home
 * (or a portal, or a home being set up) go where they belong.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { landingPath } from "@/lib/housing";
import { MarketShell } from "@/components/market/MarketChrome";
import { useMe, type Me } from "@/components/market/useMe";
import ListingCard, { type MarketListing } from "@/components/market/ListingCard";
import SearchPanel from "@/components/landing/SearchPanel";
import { SectionHeading, CommunityCards, SafetySection, CtaBand } from "@/components/landing/Sections";
import HomeQuestionCard from "./listings/_components/HomeQuestionCard";
import {
  ArrowRightIcon, CalendarIcon, ChevronRightIcon, HomeIcon, MessageIcon, PlusCircleIcon, SearchIcon, SlidersIcon, TagIcon, UsersIcon,
} from "@/components/landing/icons";

function useLatest(count: number) {
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  useEffect(() => {
    let current = true;
    async function load() {
      const res = await fetch("/api/listings/search").catch(() => null);
      const data = res?.ok ? await res.json() : { listings: [] };
      if (current) setListings(data.listings.slice(0, count));
    }
    load();
    return () => { current = false; };
  }, [count]);
  return listings;
}

function LatestListings({ title, subtitle }: { title: string; subtitle?: string }) {
  const listings = useLatest(8);
  return (
    <section>
      <SectionHeading title={title} subtitle={subtitle ?? ""} link={{ href: "/listings", label: "See all" }} />
      {listings === null ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
          <p className="font-medium text-gray-700 dark:text-gray-200">No listings yet</p>
          <p className="mt-1 text-sm text-gray-500">Be the first to post an apartment or a room to share.</p>
          <Link href="/listings/new" className="mt-5 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Post a listing</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {listings.map(l => <ListingCard key={l.id} listing={l} layout="tile" />)}
        </div>
      )}
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
      <section className="bg-gray-50 pb-10 dark:bg-gray-950">
        <div className="relative h-[300px] sm:h-[340px] md:h-[420px]">
          <Image src="/landing/hero.png" alt="Housemates talking in a bright city apartment" fill sizes="100vw"
            loading="eager" fetchPriority="high" className="object-cover object-[50%_58%] md:object-[50%_45%]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/5" />
          <div className="relative mx-auto max-w-7xl px-4 pt-8 text-white sm:px-6 md:pt-14 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/85 sm:text-xs">ApptMasters</p>
            <h1 className="mt-3 max-w-[15ch] text-3xl font-bold leading-[1.1] sm:text-4xl md:text-5xl">Find a safe place with people you can trust.</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
              Browse apartments and rooms posted directly by the people who have them. No account needed to look.
            </p>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 md:-mt-20 lg:px-8">
          <SearchPanel />
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 md:space-y-16 md:py-14 lg:px-8">
        <LatestListings title="Latest listings" subtitle="Every listing is reviewed before it goes live." />

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

        <CommunityCards />
        <SafetySection />
      </main>
      <CtaBand />
    </>
  );
}

function SeekerHome({ me }: { me: Me }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const quick = [
    { icon: SlidersIcon, label: "Filters" },
    { icon: TagIcon, label: "Price" },
    { icon: UsersIcon, label: "People" },
    { icon: CalendarIcon, label: "Move-in date" },
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      <div>
        <HomeQuestionCard />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Hi {me.name.split(" ")[0]},</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">Find your next home</h1>
        <p className="mt-2 max-w-xl text-gray-600 dark:text-gray-300">Browse apartments and rooms posted directly by the people who have them.</p>

        <form onSubmit={e => { e.preventDefault(); router.push(q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}` : "/listings"); }}
          className="mt-5 flex max-w-2xl items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 dark:border-gray-700 dark:bg-gray-900">
          <SearchIcon className="h-6 w-6 text-gray-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="City, neighborhood, or ZIP code" aria-label="City, neighborhood, or ZIP code"
            className="min-w-0 flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white" />
          <button type="submit" className="hidden rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:block">Search</button>
        </form>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {quick.map(({ icon: Icon, label }) => (
            <Link key={label} href="/listings?panel=1"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-brand/20 bg-brand-soft/50 p-5 dark:bg-brand/15">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-brand dark:bg-brand/30 dark:text-emerald-200"><HomeIcon className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">Already have a place?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Create a household or join an existing one to manage your home with your roommates.</p>
          </div>
          <Link href="/how-it-works" aria-label="How it works" className="hidden text-gray-400 sm:block"><ChevronRightIcon className="h-5 w-5" /></Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <Link href="/apartment/create" className="flex items-center justify-center gap-2 rounded-xl border-2 border-brand bg-white py-3 text-sm font-semibold text-brand dark:bg-transparent dark:text-emerald-300">
            <PlusCircleIcon className="h-5 w-5" />Create a home
          </Link>
          <Link href="/apartment/join" className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
            <UsersIcon className="h-5 w-5" />Join a home
          </Link>
        </div>
      </section>

      <LatestListings title="Latest listings" />

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
  return <MarketShell>{me ? <SeekerHome me={me} /> : <VisitorHome />}</MarketShell>;
}
