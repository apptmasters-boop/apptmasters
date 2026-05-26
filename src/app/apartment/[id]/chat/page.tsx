"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import CallOverlay from "@/components/CallOverlay";

interface Sender { id: string; name: string }
interface ChatMessage {
  id: string; content: string; type: string; readBy: string; createdAt: string;
  sender: Sender;
  replyTo: { id: string; content: string; sender: Sender } | null;
}
interface Member { id: string; name: string; role: string }
interface IncomingCall { id: string; type: "VOICE" | "VIDEO"; status: string; offer: string; callerId: string; receiverId: string | null }

export default function ChatPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<Sender | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [showDMs, setShowDMs] = useState(false);
  const [callTarget, setCallTarget] = useState<{ type: "VOICE" | "VIDEO"; receiverId: string | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadMessages() {
    const res = await apiFetch(`/api/apartments/${apartmentId}/chat`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }

  async function load() {
    const [aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { role: string; user: { id: string; name: string } }) => ({ ...m.user, role: m.role })));
    const role = apt.currentUserRole;
    setIsGuest(role === "GUEST");
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUser(me);
      setCurrentUserId(me.id);
    }
    await loadMessages();
    setLoading(false);
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [apartmentId]);

  useEffect(() => {
    if (!currentUserId || callTarget || incomingCall) return;
    callPollRef.current = setInterval(async () => {
      const res = await apiFetch(`/api/apartments/${apartmentId}/calls`);
      if (!res.ok) return;
      const call = await res.json();
      if (!call || call.status !== "RINGING") return;
      if (call.callerId === currentUserId) return;
      if (call.receiverId && call.receiverId !== currentUserId) return;
      setIncomingCall(call);
    }, 2500);
    return () => { if (callPollRef.current) clearInterval(callPollRef.current); };
  }, [apartmentId, currentUserId, callTarget, incomingCall]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    await apiFetch(`/api/apartments/${apartmentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ content, replyToId: replyTo?.id ?? null }),
    });
    setContent("");
    setReplyTo(null);
    setSending(false);
    await loadMessages();
  }

  async function sendEmergency() {
    if (!content.trim()) return;
    setSending(true);
    await apiFetch(`/api/apartments/${apartmentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ content, type: "EMERGENCY" }),
    });
    setContent("");
    setSending(false);
    await loadMessages();
  }

  async function deleteMessage(id: string) {
    await apiFetch(`/api/apartments/${apartmentId}/chat/${id}`, { method: "DELETE" });
    await loadMessages();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const otherMembers = members.filter(m => m.id !== currentUser?.id && m.role !== "GUEST");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">←</Link>
          <span className="font-bold text-gray-900">Group Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowDMs(s => !s)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Direct messages">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button onClick={() => setCallTarget({ type: "VOICE", receiverId: null })}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Group voice call">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button onClick={() => setCallTarget({ type: "VIDEO", receiverId: null })}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Group video call">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <NotificationBell apartmentId={apartmentId} />
        </div>
      </header>

      {/* DM sidebar */}
      {showDMs && (
        <div className="absolute top-14 right-4 z-40 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">Direct messages</p>
          {otherMembers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No other members</p>
          ) : otherMembers.map(m => (
            <Link key={m.id} href={`/apartment/${apartmentId}/chat/dm/${m.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              onClick={() => setShowDMs(false)}>
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600">
                {m.name[0].toUpperCase()}
              </div>
              <p className="text-sm text-gray-700">{m.name}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" onClick={() => setShowDMs(false)}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">No messages yet. Say hello!</div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender.id === currentUser?.id;
          const isEmergency = msg.type === "EMERGENCY";
          const isSystem = msg.type === "SYSTEM";
          const isAdmin = members.find(m => m.id === currentUser?.id)?.role === "ADMIN";

          if (isSystem) return (
            <div key={msg.id} className="text-center text-xs text-gray-400 py-1">{msg.content}</div>
          );

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {!isMe && <p className="text-[10px] text-gray-400 mb-1 ml-1">{msg.sender.name}</p>}
                {msg.replyTo && (
                  <div className={`text-[10px] px-2 py-1 rounded-lg mb-1 border-l-2 ${isMe ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-gray-300 bg-gray-100 text-gray-500"}`}>
                    <span className="font-medium">{msg.replyTo.sender.name}:</span> {msg.replyTo.content.slice(0, 60)}{msg.replyTo.content.length > 60 ? "…" : ""}
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm relative ${
                  isEmergency ? "bg-red-500 text-white font-semibold" :
                  isMe ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-800"
                }`}>
                  {isEmergency && <span className="mr-1">🚨</span>}
                  {msg.content}
                  <div className="absolute bottom-1 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setReplyTo(msg)}
                      className="text-[9px] text-gray-300 hover:text-gray-500 bg-white px-1 rounded">↩</button>
                    {(isMe || isAdmin) && (
                      <button onClick={() => deleteMessage(msg.id)}
                        className="text-[9px] text-gray-300 hover:text-red-400 bg-white px-1 rounded">×</button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 mx-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-indigo-600">
            Replying to <span className="font-semibold">{replyTo.sender.name}</span>: {replyTo.content.slice(0, 50)}…
          </p>
          <button onClick={() => setReplyTo(null)} className="text-xs text-indigo-400 hover:text-indigo-600 ml-2">×</button>
        </div>
      )}

      {/* Input */}
      {isGuest ? (
        <div className="px-4 py-3 bg-white border-t border-gray-200 text-center text-sm text-gray-400 flex-shrink-0">
          Guests cannot send messages
        </div>
      ) : (
        <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex gap-2 flex-shrink-0">
          <input
            type="text" placeholder="Message…" value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" disabled={!content.trim() || sending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Send
          </button>
          <button type="button" onClick={sendEmergency} disabled={!content.trim() || sending}
            title="Emergency broadcast"
            className="bg-red-500 text-white px-3 py-2 rounded-full text-sm font-bold hover:bg-red-600 disabled:opacity-40 transition-colors">
            🚨
          </button>
        </form>
      )}

      {/* Call overlay */}
      {(incomingCall || callTarget) && (
        <CallOverlay
          apartmentId={apartmentId}
          currentUserId={currentUserId}
          receiverId={incomingCall?.receiverId ?? callTarget?.receiverId ?? null}
          callType={incomingCall?.type ?? callTarget?.type ?? "VOICE"}
          incomingCall={incomingCall ?? undefined}
          onClose={() => {
            setIncomingCall(null);
            setCallTarget(null);
          }}
        />
      )}
    </div>
  );
}
