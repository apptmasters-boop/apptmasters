"use client";
/**
 * More (Sprint 12; MARKETPLACE_FLOW.md §21; design docs/mockups/more-mobile.jpg):
 * the secondary things, for someone without a home: profile, Create or Join a
 * Home, searching and listings, messages, account. Visitors see how to join.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { apiFetch, clearToken } from "@/lib/api";
import { useMe, forgetMe, initials } from "@/components/market/useMe";
import { useSavedIds } from "@/components/market/saved";
import { SearchHomeArt } from "@/components/market/Illustrations";
import { Group, Row } from "@/components/market/SettingsList";
import { languagesOn } from "@/components/LanguageButton";
import { LOCALE_NAMES } from "@/i18n/locales";
import {
  CameraIcon, ChevronRightIcon, HeartIcon, HelpCircleIcon, HomeIcon, ListIcon, LogOutIcon, MessageIcon, PlusCircleIcon,
  SearchIcon, SettingsIcon, UsersIcon, InfoIcon, GlobeIcon,
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

/** Language (T1): on every phone's More, since most phone pages have no top bar for the 🌐 button. */
function LanguageRow() {
  const t = useTranslations("language");
  const locale = useLocale();
  if (!languagesOn) return null;
  return <Row href="/settings/language" icon={<GlobeIcon className="h-5 w-5" />} label={t("title")} description={LOCALE_NAMES[locale]} />;
}

const count = (n: number | null) => n === null ? null : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">{n}</span>;

export default function MorePage() {
  const me = useMe();
  const router = useRouter();
  const saved = useSavedIds();
  const [myListings, setMyListings] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const t = useTranslations("more");
  const nav = useTranslations("nav");
  const common = useTranslations("common");

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

  if (me === undefined) return <main className="py-16 text-center text-sm text-gray-400">{common("loading")}</main>;

  if (me === null) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t("title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("visitorSubtitle")}</p>
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-soft/60 p-5 dark:bg-brand/15">
          <p className="font-semibold text-gray-900 dark:text-white">{t("visitorCardTitle")}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("visitorCardText")}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/signup?returnTo=/" className="flex-1 rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark">{nav("signUp")}</Link>
            <Link href="/login?returnTo=/" className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-center text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">{nav("logIn")}</Link>
          </div>
        </div>
        <Group title={t("groupApp")}>
          <LanguageRow />
          <Row href="/listings" icon={<SearchIcon className="h-5 w-5" />} label={t("searchApartmentsRooms")} />
          <Row href="/how-it-works" icon={<InfoIcon className="h-5 w-5" />} label={nav("howItWorks")} />
          <Row href="/listings/new" icon={<PlusCircleIcon className="h-5 w-5" />} label={nav("postAListing")} />
          <Row href="/help" icon={<HelpCircleIcon className="h-5 w-5" />} label={t("helpSupport")} />
        </Group>
      </main>
    );
  }

  const seeking = me.homes.length === 0;
  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        <Link href="/settings" aria-label={nav("settings")} className="rounded-full p-2 text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><SettingsIcon className="h-6 w-6" /></Link>
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
          <span className="absolute -bottom-0.5 -end-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" aria-label={t("changePhoto")}>
            <CameraIcon className="h-4 w-4" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold text-gray-900 dark:text-white">{me.name}</span>
          <span className="block truncate text-sm text-gray-500">{me.email}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-brand dark:text-emerald-300">{t("viewProfile")}<ChevronRightIcon className="h-4 w-4" /></span>
        </span>
      </Link>

      {me.pending ? (
        <BigCard href="/apartment/join/status" icon={<HomeIcon className="h-6 w-6" />} title={t("joinWaitingTitle")} text={t("joinWaitingText")} />
      ) : seeking && (
        <Link href="/listings" className="mt-4 flex items-center gap-4 rounded-2xl border border-brand/20 bg-brand-soft/60 p-4 dark:bg-brand/15">
          <SearchHomeArt className="h-16 w-24 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900 dark:text-white">{t("stillLookingTitle")}</span>
            <span className="block text-sm text-gray-600 dark:text-gray-300">{t("stillLookingText")}</span>
          </span>
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        </Link>
      )}

      <section className="mt-6">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("groupHousing")}</h2>
        {me.homes.length > 0 ? (
          <BigCard href={`/apartment/${me.homes[0].id}`} icon={<HomeIcon className="h-6 w-6" />} title={me.homes[0].name} text={t("yourHomeText")} />
        ) : (
          <>
            <BigCard href="/apartment/create" icon={<HomeIcon className="h-6 w-6" />} title={nav("createAHome")} text={t("createHomeText")} />
            <BigCard href="/apartment/join" icon={<UsersIcon className="h-6 w-6" />} title={nav("joinAHome")} text={t("joinHomeText")} />
          </>
        )}
      </section>

      <Group title={t("groupSearch")}>
        <Row href="/listings" icon={<SearchIcon className="h-5 w-5" />} label={t("searchApartments")} />
        <Row href="/saved" icon={<HeartIcon className="h-5 w-5" />} label={t("savedListings")} badge={count(saved.size)} />
        <Row href="/listings/mine" icon={<ListIcon className="h-5 w-5" />} label={nav("myListings")} badge={count(myListings)} />
        <Row href="/listings/new" icon={<PlusCircleIcon className="h-5 w-5" />} label={nav("postAListing")} />
      </Group>

      {/* Without a Home, the phone bar already has Messages (fix F14, owner 2026-10-17); the household bar doesn't. */}
      {!seeking && (
        <Group title={t("groupMessages")}>
          <Row href="/listings/inbox" icon={<MessageIcon className="h-5 w-5" />} label={nav("messages")}
            badge={unread > 0 ? <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">{unread}</span> : null} />
        </Group>
      )}

      <Group title={t("groupAccount")}>
        {/* Personal information, Notifications and Login & security are inside Settings (fix F13, owner 2026-10-17). */}
        <Row href="/settings" icon={<SettingsIcon className="h-5 w-5" />} label={nav("settings")} />
        <LanguageRow />
        <Row href="/how-it-works" icon={<InfoIcon className="h-5 w-5" />} label={nav("howItWorks")} />
        <Row href="/help" icon={<HelpCircleIcon className="h-5 w-5" />} label={t("helpSupport")} />
        <Row onClick={logOut} icon={<LogOutIcon className="h-5 w-5" />} label={t("logOut")} danger />
      </Group>
    </main>
  );
}
