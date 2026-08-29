"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";

interface Message {
  id: string; content: string; read: boolean; createdAt: string;
  sender: { id: string; name: string };
}

function MessagesThread() {
  const { id: listingId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = withUserId ? `?with=${withUserId}` : "";

  async function loadMessages() {
    const res = await apiFetch(`/api/listings/${listingId}/messages${query}`);
    if (res.status === 400) { setError("Open this thread from your inbox to pick a conversation."); return; }
    if (res.ok) setMessages(await res.json());
  }

  async function load() {
    if (!getToken()) { router.replace(`/listings/signup?returnTo=${encodeURIComponent(`/listings/${listingId}/messages${query}`)}`); return; }
    const [listingRes, meRes] = await Promise.all([
      apiFetch(`/api/listings/${listingId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (listingRes.ok) {
      const listing = await listingRes.json();
      setListingTitle(listing.title);
      setOtherName(withUserId ? "" : listing.owner.name);
    }
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    await loadMessages();
    setLoading(false);
  }

  useEffect(() => { load(); }, [listingId, withUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const es = new EventSource(`/api/listings/${listingId}/messages/stream${query}${query ? "&" : "?"}token=${token}`);
    es.onmessage = e => {
      const incoming: Message[] = JSON.parse(e.data);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const next = incoming.filter(m => !existingIds.has(m.id));
        if (next.length && !otherName) setOtherName(next.find(m => m.sender.id !== currentUserId)?.sender.name ?? otherName);
        return next.length ? [...prev, ...next] : prev;
      });
    };
    return () => es.close();
  }, [listingId, withUserId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    const res = await apiFetch(`/api/listings/${listingId}/messages${query}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (res.ok) { setContent(""); await loadMessages(); }
    setSending(false);
  }

  if (loading) return <main className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ height: "75vh" }}>
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <Link href={`/listings/${listingId}`} className="text-sm text-gray-400 hover:text-gray-600">←</Link>
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
            {otherName[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-tight">{otherName || "…"}</p>
            <p className="text-xs text-gray-400 leading-tight truncate max-w-[200px]">Re: {listingTitle}</p>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center px-4">
            <p>{error} <Link href="/listings/inbox" className="text-indigo-600 hover:underline">Go to inbox</Link></p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {messages.length === 0 && <div className="text-center text-gray-400 text-sm py-12">No messages yet — say hello.</div>}
              {messages.map(msg => {
                const isMe = msg.sender.id === currentUserId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 mx-1">
                        {formatMessageTime(msg.createdAt)}
                        {isMe && <span className="ml-1">{msg.read ? "· Read" : "· Sent"}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex items-end gap-2 flex-shrink-0">
              <textarea
                rows={1}
                placeholder={`Message ${otherName || "the lister"}…`}
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
                }}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32"
              />
              <button type="submit" disabled={sending || !content.trim()}
                className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ListingMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <MessagesThread />
    </Suspense>
  );
}
