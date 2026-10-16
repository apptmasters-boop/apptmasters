"use client";
/**
 * A marketplace conversation (Sprint 12; MARKETPLACE_FLOW.md §11, §15–§17;
 * designs docs/mockups/conversation-mobile.jpg, messages-desktop.jpg). Always
 * about one listing, shown with it: on top on phones, on the right on desktop,
 * with the other conversations on the left. Contacting the advertiser opens
 * the existing conversation if there is one (the same listing and people).
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { openLiveStream } from "@/lib/liveStream";
import { apiFetch, getToken } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";
import { useConversations, ConversationList, ListingContext, Initial, roleOf } from "@/components/market/Conversations";
import type { MarketListing } from "@/components/market/ListingCard";
import { ArrowLeftIcon, CheckIcon, SendIcon } from "@/components/landing/icons";

interface Message {
  id: string; content: string; read: boolean; createdAt: string;
  sender: { id: string; name: string };
}
type Listing = MarketListing & { owner: { id: string; name: string; createdAt?: string } };

function MessagesThread() {
  const { id: listingId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversations = useConversations(!!currentUserId);

  const query = withUserId ? `?with=${withUserId}` : "";
  const myListing = !!listing && listing.owner.id === currentUserId;

  async function loadMessages() {
    const res = await apiFetch(`/api/listings/${listingId}/messages${query}`);
    if (res.status === 400) { setError("Open this conversation from your inbox."); return; }
    if (res.ok) setMessages(await res.json());
  }

  async function load() {
    if (!getToken()) { router.replace(`/signup?returnTo=${encodeURIComponent(`/listings/${listingId}/messages${query}`)}`); return; }
    const [listingRes, meRes] = await Promise.all([apiFetch(`/api/listings/${listingId}`), apiFetch("/api/auth/me")]);
    if (listingRes.ok) {
      const l: Listing = await listingRes.json();
      setListing(l);
      setOtherName(withUserId ? "" : l.owner.name);
    }
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    await loadMessages();
    setLoading(false);
  }

  useEffect(() => { load(); }, [listingId, withUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserId) return;
    return openLiveStream(`/api/listings/${listingId}/messages/stream${query}`, data => {
      const incoming = data as Message[];
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const next = incoming.filter(m => !existingIds.has(m.id));
        return next.length ? [...prev, ...next] : prev;
      });
    });
  }, [listingId, withUserId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The other person's name, from the conversation when the listing is mine.
  const fromMessages = messages.find(m => m.sender.id !== currentUserId)?.sender.name ?? "";
  const fromInbox = conversations?.find(c => c.listingId === listingId && c.otherUserId === withUserId)?.otherUserName ?? "";
  const name = otherName || fromMessages || fromInbox;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    const res = await apiFetch(`/api/listings/${listingId}/messages${query}`, { method: "POST", body: JSON.stringify({ content }) });
    if (res.ok) { setContent(""); await loadMessages(); }
    setSending(false);
  }

  if (loading) return <main className="py-16 text-center text-sm text-gray-400">Loading…</main>;

  const activeKey = `${listingId}:${withUserId ?? listing?.owner.id ?? ""}`;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const today = day(new Date().toISOString());

  return (
    <main className="mx-auto h-[calc(100dvh-8rem)] max-w-7xl lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[20rem_1fr_20rem] lg:gap-5 lg:px-8 lg:py-5">
      {/* Desktop: the other conversations */}
      <aside className="hidden overflow-y-auto rounded-2xl border border-gray-200 bg-white lg:block dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <Link href="/listings/inbox" className="text-xl font-bold text-gray-900 dark:text-white">Messages</Link>
        </div>
        {conversations && <ConversationList conversations={conversations} activeKey={activeKey} compact />}
      </aside>

      {/* The chat */}
      <section className="flex h-full min-h-0 flex-col bg-white lg:rounded-2xl lg:border lg:border-gray-200 dark:bg-gray-900 lg:dark:border-gray-800">
        <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <Link href="/listings/inbox" aria-label="Back to messages" className="-ml-1 rounded-full p-1 text-gray-800 lg:hidden dark:text-gray-200"><ArrowLeftIcon className="h-6 w-6" /></Link>
          <Initial name={name || "?"} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{name || "…"}</p>
            <p className="text-sm text-gray-500">{roleOf(myListing)}</p>
          </div>
        </header>

        {listing && <div className="border-b border-gray-100 p-3 lg:hidden dark:border-gray-800"><ListingContext listing={listing} variant="bar" /></div>}

        {error ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-gray-500">
            <p>{error} <Link href="/listings/inbox" className="font-semibold text-brand hover:underline">Go to Messages</Link></p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="mx-auto max-w-sm py-10 text-center">
                  <p className="font-semibold text-gray-900 dark:text-white">Say hello to {name.split(" ")[0] || "the advertiser"}</p>
                  <p className="mt-1 text-sm text-gray-500">Ask if it&apos;s still available or when you could visit. Contacting isn&apos;t applying: nothing is agreed until you both say so.</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender.id === currentUserId;
                const showDay = i === 0 || day(messages[i - 1].createdAt) !== day(msg.createdAt);
                return (
                  <div key={msg.id}>
                    {showDay && (
                      <p className="my-2 text-center">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{day(msg.createdAt) === today ? "Today" : day(msg.createdAt)}</span>
                      </p>
                    )}
                    <div className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && <Initial name={msg.sender.name} size="h-8 w-8 text-sm" />}
                      <div className={`flex max-w-[78%] flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                          isMe ? "rounded-br-md bg-brand-soft text-gray-900 dark:bg-brand/40 dark:text-white" : "rounded-bl-md bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"}`}>
                          {msg.content}
                        </div>
                        <p className="mx-1 mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                          {formatMessageTime(msg.createdAt)}
                          {isMe && (
                            <span className={`inline-flex ${msg.read ? "text-brand" : "text-gray-400"}`} aria-label={msg.read ? "Read" : "Sent"}>
                              <CheckIcon className="h-3.5 w-3.5" />{msg.read && <CheckIcon className="-ml-2 h-3.5 w-3.5" />}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 px-3 py-3 dark:border-gray-800">
              <label htmlFor="message" className="sr-only">Message</label>
              <textarea id="message" rows={1} placeholder="Type a message…" value={content} onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              <button type="submit" disabled={sending || !content.trim()} aria-label="Send"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark disabled:opacity-50">
                <SendIcon className="h-5 w-5" />
              </button>
            </form>
          </>
        )}
      </section>

      {/* Desktop: the listing it's about */}
      <aside className="hidden overflow-y-auto lg:block">
        {listing && <ListingContext listing={listing} variant="panel" />}
      </aside>
    </main>
  );
}

export default function ListingMessagesPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}>
      <MessagesThread />
    </Suspense>
  );
}
