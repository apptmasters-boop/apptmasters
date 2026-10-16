"use client";
/**
 * Messages (Sprint 12, look matched to the pictures in Sprint 13g;
 * MARKETPLACE_FLOW.md §15–§16; designs docs/mockups/messages-mobile.jpg,
 * messages-desktop.jpg): signed-in only. Phones: the inbox first, then a
 * conversation. Desktop: conversations on the left; opening one shows the
 * chat and the listing beside it.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { useConversations, useConversationFilter, ConversationList, ConversationSearch, ConversationTabs } from "@/components/market/Conversations";
import { MessageIcon, SearchIcon, XIcon } from "@/components/landing/icons";

export default function ListingsInboxPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [searching, setSearching] = useState(false);
  const conversations = useConversations(signedIn);
  const { tab, setTab, text, setText, shown, counts, unread } = useConversationFilter(conversations);

  useEffect(() => {
    if (!getToken()) { router.replace("/signup?returnTo=/listings/inbox"); return; }
    let current = true;
    Promise.resolve().then(() => { if (current) setSignedIn(true); });
    return () => { current = false; };
  }, [router]);

  return (
    <main className="mx-auto max-w-[96rem] px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[26rem_1fr] lg:gap-6">
        <section className="lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-5 dark:lg:border-gray-800 dark:lg:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 lg:text-2xl dark:text-white">Messages</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conversations with advertisers and people interested in your listings</p>
            </div>
            <button type="button" onClick={() => { setSearching(s => !s); if (searching) setText(""); }} aria-expanded={searching}
              aria-label={searching ? "Close search" : "Search conversations"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100 lg:hidden dark:text-gray-200 dark:hover:bg-gray-800">
              {searching ? <XIcon className="h-6 w-6" /> : <SearchIcon className="h-6 w-6" />}
            </button>
          </div>
          <div className={`mt-4 ${searching ? "" : "hidden lg:block"}`}><ConversationSearch value={text} onChange={setText} autoFocus={searching} /></div>
          <div className="mt-4 lg:hidden"><ConversationTabs tab={tab} setTab={setTab} counts={counts} unread={unread} /></div>
          <div className="mt-4 hidden lg:block"><ConversationTabs tab={tab} setTab={setTab} counts={counts} unread={unread} compact /></div>

          <div className="-mx-4 mt-4 border-t border-gray-100 lg:mx-0 lg:mt-3 lg:border-0 dark:border-gray-800">
            {conversations === null ? (
              <p className="py-12 text-center text-sm text-gray-400">Loading…</p>
            ) : shown.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <MessageIcon className="mx-auto h-10 w-10 text-gray-300" />
                {text.trim() ? (
                  <p className="mt-3 font-semibold text-gray-900 dark:text-white">No conversation matches &ldquo;{text}&rdquo;</p>
                ) : (
                  <>
                    <p className="mt-3 font-semibold text-gray-900 dark:text-white">No conversations yet</p>
                    <p className="mt-1 text-sm text-gray-500">Contact an advertiser from a listing, or wait for someone to write about yours.</p>
                    <Link href="/listings" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Find a Home</Link>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="lg:hidden"><ConversationList conversations={shown} /></div>
                <div className="hidden lg:-mx-5 lg:block"><ConversationList conversations={shown} compact /></div>
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
