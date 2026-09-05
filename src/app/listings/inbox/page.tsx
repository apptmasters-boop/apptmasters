"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getToken } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";

interface Conversation {
  listingId: string; listingTitle: string; listingPhoto: string | null;
  otherUserId: string; otherUserName: string;
  lastMessage: string; lastMessageAt: string; unread: boolean;
}

export default function ListingsInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace("/listings/signup?returnTo=/listings/inbox"); return; }
    (async () => {
      const res = await apiFetch("/api/listings/inbox");
      if (res.ok) setConversations(await res.json());
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>
      {conversations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-gray-600 font-medium mb-1">No conversations yet</p>
          <p className="text-sm text-gray-400">When someone messages you about a listing, it'll show up here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {conversations.map(c => (
            <Link key={`${c.listingId}:${c.otherUserId}`}
              href={`/listings/${c.listingId}/messages?with=${c.otherUserId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl">
                {c.listingPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.listingPhoto} alt="" className="w-full h-full object-cover" />
                ) : "🏠"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${c.unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{c.otherUserName}</p>
                  {c.unread && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 truncate">{c.listingTitle}</p>
                <p className={`text-sm truncate mt-0.5 ${c.unread ? "text-gray-800" : "text-gray-500"}`}>{c.lastMessage}</p>
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">{formatMessageTime(c.lastMessageAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
