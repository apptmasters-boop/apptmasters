"use client";
/**
 * Marketplace messages (Sprint 12, look matched to the pictures in Sprint 13g;
 * MARKETPLACE_FLOW.md §15–§16; designs docs/mockups/messages-mobile.jpg,
 * conversation-mobile.jpg, messages-desktop.jpg). A conversation is always
 * about one listing, which stays visible next to it. Online status, calls,
 * photos, voice and "schedule a viewing" from the pictures aren't features we
 * have, so they're left out.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";
import { placeKind } from "@/lib/listingFields";
import { useSavedIds, toggleSaved } from "./saved";
import {
  BathIcon, BedIcon, BuildingIcon, CheckIcon, ChevronRightIcon, FlagIcon, HeartIcon, HomeIcon, PinIcon, SearchIcon, ShareIcon, UsersIcon,
} from "@/components/landing/icons";
import { priceText, placeText, type MarketListing } from "./ListingCard";

export interface Conversation {
  listingId: string; listingTitle: string; listingPhoto: string | null; listingCity: string; myListing: boolean;
  listingPrice: number; listingPriceMax: number | null; listingBedrooms: number | null; listingStatus: string;
  otherUserId: string; otherUserName: string; otherUserPhoto?: string | null; otherUserSince?: string;
  lastMessage: string; lastMessageAt: string; unread: boolean; unreadCount?: number;
}

export const conversationHref = (c: Pick<Conversation, "listingId" | "otherUserId">) => `/listings/${c.listingId}/messages?with=${c.otherUserId}`;
/** Who the other person is in this conversation. */
export const roleOf = (myListing: boolean) => (myListing ? "Interested in your listing" : "Advertiser");

export function useConversations(enabled: boolean) {
  const [list, setList] = useState<Conversation[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    async function load() {
      const res = await apiFetch("/api/listings/inbox").catch(() => null);
      const data = res?.ok ? await res.json() : [];
      if (current) setList(data);
    }
    load();
    return () => { current = false; };
  }, [enabled]);
  return list;
}

/** A person's profile photo, or the first letter of their name. */
export function Avatar({ name, photo, size = "h-12 w-12 text-lg" }: { name: string; photo?: string | null; size?: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200`}>{name[0]?.toUpperCase() ?? "?"}</span>
  );
}

export type ConversationTab = "all" | "asked" | "mine";

/** The tabs and the search box over a list of conversations. */
export function useConversationFilter(conversations: Conversation[] | null) {
  const [tab, setTab] = useState<ConversationTab>("all");
  const [text, setText] = useState("");
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (conversations ?? []).filter(c => (tab === "all" || (tab === "mine" ? c.myListing : !c.myListing)) &&
      (!q || [c.otherUserName, c.listingTitle, c.listingCity, c.lastMessage].some(v => v.toLowerCase().includes(q))));
  }, [conversations, tab, text]);
  const counts = {
    all: conversations?.length ?? 0,
    asked: conversations?.filter(c => !c.myListing).length ?? 0,
    mine: conversations?.filter(c => c.myListing).length ?? 0,
  };
  const unread = (conversations ?? []).filter(c => c.unread).length;
  return { tab, setTab, text, setText, shown, counts, unread };
}

export function ConversationSearch({ value, onChange, autoFocus = false }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="relative block">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="Search conversations…" aria-label="Search conversations" autoFocus={autoFocus}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
    </label>
  );
}

export function ConversationTabs({ tab, setTab, counts, unread, compact = false }: {
  tab: ConversationTab; setTab: (t: ConversationTab) => void; counts: Record<ConversationTab, number>; unread: number; compact?: boolean;
}) {
  const tabs: [ConversationTab, string][] = [["all", "All"], ["asked", compact ? "Asked about" : "Places I asked about"], ["mine", "My listings"]];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Conversations">
      {tabs.map(([value, label]) => (
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full font-semibold ${compact ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-sm"} ${
            tab === value ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"}`}>
          {label}
          {value === "all" && unread > 0
            ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white" aria-label={`${unread} unread`}>{unread}</span>
            : <span className={`rounded-full px-2 text-xs ${tab === value ? "bg-white/20" : "bg-white dark:bg-gray-900"}`}>{counts[value]}</span>}
        </button>
      ))}
    </div>
  );
}

function ListingMini({ c }: { c: Conversation }) {
  const price = priceText({ price: c.listingPrice, priceMax: c.listingPriceMax });
  return (
    <span className="mt-2.5 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-950">
      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-300 dark:bg-gray-800">
        {c.listingPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.listingPhoto} alt="" className="h-full w-full object-cover" />
        ) : <HomeIcon className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.listingTitle}</span>
        <span className="block truncate text-[13px] text-gray-600 dark:text-gray-400">
          {[price, c.listingBedrooms !== null ? (c.listingBedrooms === 0 ? "Studio" : `${c.listingBedrooms} bd`) : null, c.listingCity].filter(Boolean).join(" · ")}
          {c.listingStatus !== "APPROVED" && " · no longer available"}
        </span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
    </span>
  );
}

export function ConversationList({ conversations, activeKey, compact = false }: { conversations: Conversation[]; activeKey?: string; compact?: boolean }) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {conversations.map(c => {
        const key = `${c.listingId}:${c.otherUserId}`;
        const active = key === activeKey;
        const unread = c.unreadCount ?? (c.unread ? 1 : 0);
        return (
          <li key={key}>
            <Link href={conversationHref(c)} aria-current={active ? "page" : undefined}
              className={`flex gap-3 px-4 py-4 transition-colors ${active ? "bg-brand-soft/70 dark:bg-brand/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
              <Avatar name={c.otherUserName} photo={c.otherUserPhoto} size={compact ? "h-11 w-11 text-base" : "h-14 w-14 text-xl"} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${unread ? "font-bold" : "font-semibold"} text-[15px] text-gray-900 dark:text-white`}>{c.otherUserName}</span>
                  <span className="shrink-0 text-xs text-gray-500">{formatMessageTime(c.lastMessageAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] text-gray-500">{roleOf(c.myListing)}</span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white" aria-label={`${unread} unread`}>{unread}</span>
                  )}
                </span>
                <span className={`mt-0.5 block ${compact ? "truncate" : "line-clamp-2"} text-sm ${unread ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>{c.lastMessage}</span>
                {!compact && <ListingMini c={c} />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The person you're talking to, in the desktop panel. */
export interface Contact { name: string; photo?: string | null; role: string; since?: string }

function QuickAction({ icon: Icon, children, onClick, href, danger = false }: {
  icon: (p: { className?: string }) => React.ReactNode; children: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean;
}) {
  const className = `flex w-full items-center gap-3 border-b border-gray-100 py-3 text-left text-sm last:border-0 dark:border-gray-800 ${
    danger ? "text-red-600 dark:text-red-400" : "text-gray-800 hover:text-brand dark:text-gray-200"}`;
  return href
    ? <Link href={href} className={className}><Icon className="h-5 w-5" />{children}</Link>
    : <button type="button" onClick={onClick} className={className}><Icon className="h-5 w-5" />{children}</button>;
}

/** The listing the conversation is about: on top on phones, on the right on desktop with the contact and quick actions. */
export function ListingContext({ listing, variant, contact, mine = false }: {
  listing: MarketListing & { owner: { id: string; name: string; createdAt?: string } };
  variant: "bar" | "panel"; contact?: Contact; mine?: boolean;
}) {
  const saved = useSavedIds().has(listing.id);
  const [copied, setCopied] = useState(false);
  const facts = (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-gray-600 dark:text-gray-300">
      {listing.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedIcon className="h-4 w-4" />{listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bd`}</span>}
      {listing.bathrooms !== null && <span className="inline-flex items-center gap-1"><BathIcon className="h-4 w-4" />{listing.bathrooms} ba</span>}
      {listing.maxOccupants ? <span className="inline-flex items-center gap-1"><UsersIcon className="h-4 w-4" />Max {listing.maxOccupants}</span> : null}
      <span className="inline-flex items-center gap-1"><BuildingIcon className="h-4 w-4" />{placeKind(listing)}</span>
    </span>
  );
  const photo = listing.photos[0]?.url;
  const city = [listing.city, [listing.state, listing.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  if (variant === "bar") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-3">
          <span className="flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300 dark:bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <HomeIcon className="h-7 w-7" />}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block truncate font-semibold text-gray-900 dark:text-white">{listing.title}</span>
            <span className="block text-lg font-bold leading-tight text-brand dark:text-emerald-300">{priceText(listing)}</span>
            {facts}
            <span className="flex items-center gap-1 truncate text-[13px] text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{city}</span>
          </span>
        </div>
        <Link href={`/listings/${listing.id}`} className="mt-3 block rounded-xl border-[1.5px] border-brand py-2 text-center text-sm font-semibold text-brand dark:text-emerald-300">View listing</Link>
      </div>
    );
  }

  async function share() {
    const url = `${window.location.origin}/listings/${listing.id}`;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* the person closed the share sheet */ }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>}
          {listing.photos.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-0.5 text-xs text-white">1/{listing.photos.length}</span>}
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{priceText(listing)}</p>
          <p className="font-semibold text-gray-800 dark:text-gray-100">{listing.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4 shrink-0" />{placeText(listing)}</p>
          {facts}
          <Link href={`/listings/${listing.id}`} className="mt-2 block rounded-xl border-[1.5px] border-brand py-2.5 text-center text-sm font-semibold text-brand dark:text-emerald-300">View full listing</Link>
        </div>
      </div>

      {contact && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Contact information</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={contact.name} photo={contact.photo} size="h-14 w-14 text-xl" />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-semibold text-gray-900 dark:text-white">{contact.name}</span>
                <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{contact.role}</span>
              </span>
              {contact.since && <span className="block text-sm text-gray-500">Member since {new Date(contact.since).getFullYear()}</span>}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><CheckIcon className="h-3 w-3" /></span>Email confirmed
          </p>
          <p className="mt-3 text-xs text-gray-500">Contacting isn&apos;t applying: agree on a visit, the lease and payment directly. Never pay before you&apos;ve seen the place.</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
        <p className="pb-1 pt-2 text-sm font-semibold text-gray-900 dark:text-white">Quick actions</p>
        {!mine && (
          <QuickAction icon={HeartIcon} onClick={() => toggleSaved(listing.id)}>{saved ? "Remove from Saved" : "Save listing"}</QuickAction>
        )}
        <QuickAction icon={ShareIcon} onClick={share}>{copied ? "Link copied" : "Share listing"}</QuickAction>
        {!mine && <QuickAction icon={FlagIcon} href={`/listings/${listing.id}?report=1`} danger>Report this listing</QuickAction>}
      </div>
    </div>
  );
}
