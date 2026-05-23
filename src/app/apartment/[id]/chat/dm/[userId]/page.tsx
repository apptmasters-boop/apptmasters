"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import CallOverlay from "@/components/CallOverlay";

interface DirectMessage { id: string; content: string; read: boolean; createdAt: string; sender: { id: string; name: string } }

export default function DMPage() {
  const { id: apartmentId, userId: otherUserId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [otherName, setOtherName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [callTarget, setCallTarget] = useState<"VOICE" | "VIDEO" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadMessages() {
    const res = await apiFetch(`/api/apartments/${apartmentId}/dm/${otherUserId}`);
    if (res.ok) setMessages(await res.json());
  }

  async function load() {
    const [aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    const apt = await aptRes.json();
    const other = apt.members.find((m: { user: { id: string; name: string } }) => m.user.id === otherUserId);
    setOtherName(other?.user.name ?? "Unknown");
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    await loadMessages();
    setLoading(false);
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [apartmentId, otherUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    await apiFetch(`/api/apartments/${apartmentId}/dm/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    setContent("");
    setSending(false);
    await loadMessages();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}/chat`} className="text-sm text-gray-400 hover:text-gray-600">←</Link>
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
            {otherName[0]?.toUpperCase()}
          </div>
          <span className="font-bold text-gray-900">{otherName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCallTarget("VOICE")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Voice call">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button onClick={() => setCallTarget("VIDEO")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Video call">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">No messages yet.</div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender.id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 mx-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {isMe && <span className="ml-1">{msg.read ? "· Read" : "· Sent"}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex gap-2 flex-shrink-0">
        <input
          type="text" placeholder={`Message ${otherName}…`} value={content}
          onChange={e => setContent(e.target.value)}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" disabled={!content.trim() || sending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          Send
        </button>
      </form>

      {callTarget && (
        <CallOverlay
          apartmentId={apartmentId}
          callerId={currentUserId}
          receiverId={otherUserId}
          callType={callTarget}
          onClose={() => setCallTarget(null)}
        />
      )}
    </div>
  );
}
