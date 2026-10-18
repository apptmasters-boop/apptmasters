"use client";
/**
 * More (Sprint 12; MARKETPLACE_FLOW.md §21; design docs/mockups/more-mobile.jpg):
 * the secondary things, for someone without a home: profile, Create or Join a
 * Home, searching and listings, messages, account. Visitors see how to join.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/api";
import { useMe, forgetMe, initials } from "@/components/market/useMe";
import { useSavedIds } from "@/components/market/saved";
import { SearchHomeArt } from "@/components/market/Illustrations";
import { Group, Row } from "@/components/market/SettingsList";
import {
  CameraIcon, ChevronRightIcon, HeartIcon, HelpCircleIcon, HomeIcon, ListIcon, LogOutIcon, MessageIcon, PlusCircleIcon,
  SearchIcon, SettingsIcon, UsersIcon, InfoIcon,
} from "@/components/landing/icons";

function BigCard({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="mt-2 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand/40 dark:border-gray-800 dark:bg-gray-900">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900 dark:text-white">{title}</span>
        <span className="block text-sm text-gray-500 dark:text-gray-400">{text}</span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400" />
    </Link>
  );
}

const count = (n: number | null) => n === null ? null : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">{n}</span>;

export default function MorePage() {
  const me = useMe();
  const router = useRouter();
  const saved = useSavedIds();
  const [myListings, setMyListings] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) return;
    let current = true;
    async function load() {
      const [mine, inbox] = await Promise.all([apiFetch("/api/listings/mine").catch(() => null), apiFetch("/api/listings/inbox").catch(() => null)]);
      if (!current) return;
      if (mine?.ok) { const list = await mine.json(); if (current) setMyListings(Array.isArray(list) ? list.length : 0); }
      if (inbox?.ok) { const list: { unread: boolean }[] = await inbox.json(); if (current) setUnread(list.filter(c => c.unread).length); }
    }
    load();
    return () => { current = false; };
  }, [me]);

  function logOut() {
    clearToken();
    forgetMe();
    router.push("/");
    router.refresh();
  }

  if (me === undefined) return <main className="py-16 text-center text-sm text-gray-400">Loading…</main>;

  if (me === null) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">More</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Find a home, then manage it with your roommates.</p>
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-soft/60 p-5 dark:bg-brand/15">
          <p className="font-semibold text-gray-900 dark:text-white">Save listings and message advertisers</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Browsing is open to everyone. An account is only needed for personal things.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/signup?returnTo=/" className="flex-1 rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark">Sign up</Link>
            <Link href="/login?returnTo=/" className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-center text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">Log in</Link>
          </div>
        </div>
        <Group title="ApptMasters">
          <Row href="/listings" icon={<SearchIcon className="h-5 w-5" />} label="Search apartments and rooms" />
          <Row href="/how-it-works" icon={<InfoIcon className="h-5 w-5" />} label="How It Works" />
          <Row href="/listings/new" icon={<PlusCircleIcon className="h-5 w-5" />} label="Post a listing" />
          <Row href="/help" icon={<HelpCircleIcon className="h-5 w-5" />} label="Help & support" />
        </Group>
      </main>
    );
  }

  const seeking = me.homes.length === 0;
  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">More</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account and housing journey</p>
        </div>
        <Link href="/settings" aria-label="Settings" className="rounded-full p-2 text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><SettingsIcon className="h-6 w-6" /></Link>
      </div>

      <Link href="/profile" className="mt-5 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-brand/40 dark:border-gray-800 dark:bg-gray-900">
        {/* The camera badge: the profile is where the photo is added or changed (docs/mockups/more-mobile.jpg). */}
        <span className="relative shrink-0">
          {me.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.photo} alt="" className="h-[4.5rem] w-[4.5rem] rounded-full object-cover" />
          ) : (
            <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-brand-soft text-2xl font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">{initials(me.name)}</span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" aria-label="Change photo">
            <CameraIcon className="h-4 w-4" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold text-gray-900 dark:text-white">{me.name}</span>
          <span className="block truncate text-sm text-gray-500">{me.email}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-brand dark:text-emerald-300">View profile<ChevronRightIcon className="h-4 w-4" /></span>
        </span>
      </Link>

      {me.pending ? (
        <BigCard href="/apartment/join/status" icon={<HomeIcon className="h-6 w-6" />} title="Your join request is waiting" text="See where it stands on Join status." />
      ) : seeking && (
        <Link href="/listings" className="mt-4 flex items-center gap-4 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 dark:bg-brand/15">
          <SearchHomeArt className="h-16 w-24 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900 dark:text-white">Still looking for a place?</span>
            <span className="block text-sm text-gray-600 dark:text-gray-300">Keep searching and save your favorite listings.</span>
          </span>
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        </Link>
      )}

      <section className="mt-6">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Housing</h2>
        {me.homes.length > 0 ? (
          <BigCard href={`/apartment/${me.homes[0].id}`} icon={<HomeIcon className="h-6 w-6" />} title={me.homes[0].name} text="Your home: household, money, chat and more." />
        ) : (
          <>
            <BigCard href="/apartment/create" icon={<HomeIcon className="h-6 w-6" />} title="Create a Home" text="If you already have a place, create a home to manage your household, expenses and more." />
            <BigCard href="/apartment/join" icon={<UsersIcon className="h-6 w-6" />} title="Join a Home" text="Have a roommate invite you? Join a home to use the household features." />
          </>
        )}
      </section>

      <Group title="Search & listings">
        <Row href="/listings" icon={<SearchIcon className="h-5 w-5" />} label="Search apartments" />
        <Row href="/saved" icon={<HeartIcon className="h-5 w-5" />} label="Saved listings" badge={count(saved.size)} />
        <Row href="/listings/mine" icon={<ListIcon className="h-5 w-5" />} label="My listings" badge={count(myListings)} />
        <Row href="/listings/new" icon={<PlusCircleIcon className="h-5 w-5" />} label="Post a listing" />
      </Group>

      {/* Without a Home, the phone bar already has Messages (fix F14, owner 2026-10-17); the household bar doesn't. */}
      {!seeking && (
        <Group title="Messages">
          <Row href="/listings/inbox" icon={<MessageIcon className="h-5 w-5" />} label="Messages"
            badge={unread > 0 ? <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">{unread}</span> : null} />
        </Group>
      )}

      <Group title="Account">
        {/* Personal information, Notifications and Login & security are inside Settings (fix F13, owner 2026-10-17). */}
        <Row href="/settings" icon={<SettingsIcon className="h-5 w-5" />} label="Settings" />
        <Row href="/how-it-works" icon={<InfoIcon className="h-5 w-5" />} label="How It Works" />
        <Row href="/help" icon={<HelpCircleIcon className="h-5 w-5" />} label="Help & support" />
        <Row onClick={logOut} icon={<LogOutIcon className="h-5 w-5" />} label="Log out" danger />
      </Group>
    </main>
  );
}
