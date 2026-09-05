"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const REACTION_EMOJIS: Record<string, string> = {
  THUMBS_UP: "👍",
  NOTED: "✅",
  QUESTION: "❓",
};

const TYPE_COLORS: Record<string, string> = {
  EXPENSE: "bg-emerald-100 text-emerald-700",
  CHORE_DONE: "bg-blue-100 text-blue-700",
  MEMBER_JOINED: "bg-blue-100 text-blue-700",
  RULE_ADDED: "bg-amber-100 text-amber-700",
  ANNOUNCEMENT: "bg-violet-100 text-violet-700",
  RENT: "bg-teal-100 text-teal-700",
  GROCERY: "bg-orange-100 text-orange-700",
  FUND: "bg-pink-100 text-pink-700",
};

interface Reaction { id: string; emoji: string; user: { id: string; name: string } }
interface FeedItem {
  id: string; type: string; title: string; body: string; isAnnouncement: boolean;
  link: string | null; createdAt: string;
  user: { id: string; name: string };
  reactions: Reaction[];
}

export default function FeedPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showPost, setShowPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    const [feedRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/feed`),
      apiFetch("/api/auth/me"),
    ]);
    if (feedRes.status === 401) { router.replace("/login"); return; }
    setItems(await feedRes.json());
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    await apiFetch(`/api/apartments/${apartmentId}/feed`, {
      method: "POST",
      body: JSON.stringify({ title: newTitle, body: newBody }),
    });
    setNewTitle("");
    setNewBody("");
    setShowPost(false);
    setPosting(false);
    load();
  }

  async function react(itemId: string, emoji: string) {
    const res = await apiFetch(`/api/apartments/${apartmentId}/feed/${itemId}/react`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const reactions = await res.json();
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, reactions } : i));
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Activity Feed</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowPost(s => !s)}
            className="text-sm bg-violet-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-violet-700 transition-colors">
            + Announce
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Announcement form */}
        {showPost && (
          <form onSubmit={post} className="bg-white border border-violet-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New announcement</h3>
            <input required type="text" placeholder="Title…" value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <textarea required placeholder="What do you want to share?" value={newBody}
              onChange={e => setNewBody(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            <div className="flex gap-2">
              <button type="submit" disabled={posting}
                className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {posting ? "Posting…" : "Post"}
              </button>
              <button type="button" onClick={() => setShowPost(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No activity yet.</p>
            <p className="text-sm text-gray-400 mt-1">Actions like adding expenses, completing chores, and joining will appear here.</p>
          </div>
        ) : items.map(item => {
          const reactionCounts: Record<string, number> = {};
          const myReaction = item.reactions.find(r => r.user.id === currentUserId)?.emoji;
          item.reactions.forEach(r => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1; });

          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-600 text-sm flex-shrink-0 mt-0.5">
                    {item.user.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {item.isAnnouncement ? "Announcement" : item.type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{item.user.name} · {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {item.link && (
                  <Link href={item.link} className="text-xs text-blue-500 hover:underline flex-shrink-0">View →</Link>
                )}
              </div>

              {/* Reactions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                {Object.entries(REACTION_EMOJIS).map(([key, emoji]) => {
                  const count = reactionCounts[key] ?? 0;
                  const isMe = myReaction === key;
                  return (
                    <button key={key} onClick={() => react(item.id, key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isMe ? "bg-blue-100 border-blue-300 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                      {emoji} {count > 0 && <span>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
