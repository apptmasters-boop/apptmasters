"use client";
/**
 * Marketplace messages (Sprint 12; MARKETPLACE_FLOW.md §15–§16; designs
 * docs/mockups/messages-mobile.jpg, conversation-mobile.jpg,
 * messages-desktop.jpg). A conversation is always about one listing, which
 * stays visible next to it. Calls, photos, voice and "schedule a viewing" from
 * the pictures aren't features we have, so they're left out.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";
import { placeKind } from "@/lib/listingFields";
import { BathIcon, BedIcon, BuildingIcon, ChevronRightIcon, HomeIcon, PinIcon, UsersIcon } from "@/components/landing/icons";
import { priceText, placeText, type MarketListing } from "./ListingCard";

export interface Conversation {
  listingId: string; listingTitle: string; listingPhoto: string | null; listingCity: string; myListing: boolean;
  listingPrice: number; listingPriceMax: number | null; listingBedrooms: number | null; listingStatus: string;
  otherUserId: string; otherUserName: string;
  lastMessage: string; lastMessageAt: string; unread: boolean;
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

export function Initial({ name, size = "h-12 w-12 text-lg" }: { name: string; size?: string }) {
  return <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200`}>{name[0]?.toUpperCase() ?? "?"}</span>;
}

function ListingMini({ c }: { c: Conversation }) {
  const price = priceText({ price: c.listingPrice, priceMax: c.listingPriceMax });
  return (
    <span className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-950">
      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-300 dark:bg-gray-800">
        {c.listingPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.listingPhoto} alt="" className="h-full w-full object-cover" />
        ) : <HomeIcon className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.listingTitle}</span>
        <span className="block truncate text-xs text-gray-500">
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
        return (
          <li key={key}>
            <Link href={conversationHref(c)} aria-current={active ? "page" : undefined}
              className={`flex gap-3 px-4 py-4 transition-colors ${active ? "bg-brand-soft/70 dark:bg-brand/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
              <Initial name={c.otherUserName} size={compact ? "h-11 w-11 text-base" : "h-14 w-14 text-xl"} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${c.unread ? "font-bold" : "font-semibold"} text-gray-900 dark:text-white`}>{c.otherUserName}</span>
                  <span className="shrink-0 text-xs text-gray-500">{formatMessageTime(c.lastMessageAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-500">{roleOf(c.myListing)}</span>
                  {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="Unread" />}
                </span>
                <span className={`mt-0.5 block ${compact ? "truncate" : "line-clamp-2"} text-sm ${c.unread ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>{c.lastMessage}</span>
                {!compact && <ListingMini c={c} />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The listing the conversation is about: on top on phones, on the right on desktop. */
export function ListingContext({ listing, variant }: { listing: MarketListing & { owner: { id: string; name: string; createdAt?: string } }; variant: "bar" | "panel" }) {
  const facts = (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-gray-600 dark:text-gray-300">
      {listing.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedIcon className="h-4 w-4" />{listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bd`}</span>}
      {listing.bathrooms !== null && <span className="inline-flex items-center gap-1"><BathIcon className="h-4 w-4" />{listing.bathrooms} ba</span>}
      {listing.maxOccupants ? <span className="inline-flex items-center gap-1"><UsersIcon className="h-4 w-4" />Max {listing.maxOccupants}</span> : null}
      <span className="inline-flex items-center gap-1"><BuildingIcon className="h-4 w-4" />{placeKind(listing)}</span>
    </span>
  );
  const photo = listing.photos[0]?.url;

  if (variant === "bar") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-3">
          <span className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300 dark:bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <HomeIcon className="h-7 w-7" />}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block truncate font-semibold text-gray-900 dark:text-white">{listing.title}</span>
            <span className="block text-lg font-bold text-brand dark:text-emerald-300">{priceText(listing)}</span>
            {facts}
          </span>
        </div>
        <Link href={`/listings/${listing.id}`} className="mt-3 block rounded-xl border-2 border-brand py-2 text-center text-sm font-semibold text-brand dark:text-emerald-300">View listing</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-300"><HomeIcon className="h-10 w-10" /></div>}
          {listing.photos.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-0.5 text-xs text-white">1/{listing.photos.length}</span>}
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{priceText(listing)}</p>
          <p className="font-semibold text-gray-800 dark:text-gray-100">{listing.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300"><PinIcon className="h-4 w-4" />{placeText(listing)}</p>
          {facts}
          <Link href={`/listings/${listing.id}`} className="mt-2 block rounded-xl border-2 border-brand py-2.5 text-center text-sm font-semibold text-brand dark:text-emerald-300">View full listing</Link>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Advertiser</p>
        <div className="mt-3 flex items-center gap-3">
          <Initial name={listing.owner.name} />
          <span>
            <span className="block font-semibold text-gray-900 dark:text-white">{listing.owner.name}</span>
            {listing.owner.createdAt && <span className="block text-sm text-gray-500">Member since {new Date(listing.owner.createdAt).getFullYear()}</span>}
          </span>
        </div>
        <p className="mt-3 text-xs text-gray-500">Contacting isn&apos;t applying: agree on a visit, the lease and payment directly. Never pay before you&apos;ve seen the place.</p>
      </div>
    </div>
  );
}
