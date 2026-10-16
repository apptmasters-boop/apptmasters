"use client";
/**
 * Messages (Sprint 12; MARKETPLACE_FLOW.md §15–§16; designs
 * docs/mockups/messages-mobile.jpg, messages-desktop.jpg): signed-in only.
 * Phones: the inbox first, then a conversation. Desktop: conversations on the
 * left; opening one shows the chat and the listing beside it.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { useConversations, ConversationList } from "@/components/market/Conversations";
import { MessageIcon } from "@/components/landing/icons";

type Tab = "all" | "asked" | "mine";

export default function ListingsInboxPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const conversations = useConversations(signedIn);

  useEffect(() => {
    if (!getToken()) { router.replace("/signup?returnTo=/listings/inbox"); return; }
    let current = true;
    Promise.resolve().then(() => { if (current) setSignedIn(true); });
    return () => { current = false; };
  }, [router]);

  const counts = useMemo(() => ({
    all: conversations?.length ?? 0,
    asked: conversations?.filter(c => !c.myListing).length ?? 0,
    mine: conversations?.filter(c => c.myListing).length ?? 0,
  }), [conversations]);
  const shown = (conversations ?? []).filter(c => tab === "all" || (tab === "mine" ? c.myListing : !c.myListing));
  const unread = (conversations ?? []).filter(c => c.unread).length;
  const tabs: [Tab, string][] = [["all", "All"], ["asked", "Places I asked about"], ["mine", "My listings"]];

  return (
    <main className="mx-auto max-w-[96rem] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[24rem_1fr] lg:gap-6">
        <section>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Conversations with advertisers and people interested in your listings</p>
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Conversations">
            {tabs.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${tab === value ? "bg-brand text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"}`}>
                {label}
                {value === "all" && unread > 0
                  ? <span className="rounded-full bg-red-500 px-2 text-xs text-white" aria-label={`${unread} unread`}>{unread}</span>
                  : <span className={`rounded-full px-2 text-xs ${tab === value ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800"}`}>{counts[value]}</span>}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {conversations === null ? (
              <p className="py-12 text-center text-sm text-gray-400">Loading…</p>
            ) : shown.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <MessageIcon className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">No conversations yet</p>
                <p className="mt-1 text-sm text-gray-500">Contact an advertiser from a listing, or wait for someone to write about yours.</p>
                <Link href="/listings" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Find a Home</Link>
              </div>
            ) : (
              <>
                <div className="lg:hidden"><ConversationList conversations={shown} /></div>
                <div className="hidden lg:block"><ConversationList conversations={shown} compact /></div>
              </>
            )}
          </div>
        </section>

        <section className="hidden items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white lg:flex dark:border-gray-700 dark:bg-gray-900">
          <div className="px-6 py-20 text-center">
            <MessageIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-900 dark:text-white">Choose a conversation</p>
            <p className="mt-1 text-sm text-gray-500">The chat and the listing it&apos;s about open here.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
