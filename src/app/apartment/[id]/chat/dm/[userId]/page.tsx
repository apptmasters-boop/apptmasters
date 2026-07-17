"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMessageTime } from "@/lib/time";
import CallOverlay from "@/components/CallOverlay";
import AudioRecorder from "@/components/AudioRecorder";
import VoiceMessage from "@/components/VoiceMessage";

interface DirectMessage {
  id: string; content: string; type: string; read: boolean; createdAt: string;
  sender: { id: string; name: string };
}
interface IncomingCall { id: string; type: "VOICE" | "VIDEO"; status: string; offer: string; callerId: string; receiverId: string | null }

export default function DMPage() {
  const { id: apartmentId, userId: otherUserId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const [messages, setMessages]   = useState<DirectMessage[]>([]);
  const [otherName, setOtherName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [incomingCall, setIncomingCall]   = useState<IncomingCall | null>(null);
  const [loading, setLoading]     = useState(true);
  const [content, setContent]     = useState("");
  const [sending, setSending]     = useState(false);
  const [callTarget, setCallTarget]     = useState<"VOICE" | "VIDEO" | null>(null);
  const [recorderActive, setRecorderActive] = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const es = new EventSource(`/api/apartments/${apartmentId}/dm/${otherUserId}/stream?token=${token}`);
    es.onmessage = e => {
      const incoming: DirectMessage[] = JSON.parse(e.data);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const next = incoming.filter(m => !existingIds.has(m.id));
        return next.length ? [...prev, ...next] : prev;
      });
    };
    return () => es.close();
  }, [apartmentId, otherUserId]);

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

  async function sendAudio(blob: Blob, mimeType: string) {
    setSending(true);
    const form = new FormData();
    form.append("audio", blob, `voice.${mimeType.includes("mp4") ? "mp4" : "webm"}`);
    const uploadRes = await apiFetch("/api/upload/audio", { method: "POST", body: form });
    if (!uploadRes.ok) { setSending(false); return; }
    const { url } = await uploadRes.json();
    await apiFetch(`/api/apartments/${apartmentId}/dm/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({ content: url, type: "AUDIO" }),
    });
    setSending(false);
    await loadMessages();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    // h-screen keeps header + footer pinned — only the message list scrolls
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* Sticky header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
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

      {/* Messages — this is the only part that scrolls */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">No messages yet.</div>
        )}
        {messages.map(msg => {
          const isMe    = msg.sender.id === currentUserId;
          const isAudio = msg.type === "AUDIO";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {isAudio ? (
                  <VoiceMessage src={msg.content} isMe={isMe} />
                ) : (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                    {msg.content}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5 mx-1">
                  {formatMessageTime(msg.createdAt)}
                  {isMe && !isAudio && <span className="ml-1">{msg.read ? "· Read" : "· Sent"}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
        {recorderActive ? (
          <AudioRecorder
            sending={sending}
            onSend={sendAudio}
            onActiveChange={setRecorderActive}
          />
        ) : (
          <>
            <input
              type="text" placeholder={`Message ${otherName}…`} value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {content.trim() ? (
              <button type="submit" disabled={sending}
                className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0">
                Send
              </button>
            ) : (
              <AudioRecorder
                sending={sending}
                onSend={sendAudio}
                onActiveChange={setRecorderActive}
              />
            )}
          </>
        )}
      </form>

      {(incomingCall || callTarget) && (
        <CallOverlay
          apartmentId={apartmentId}
          currentUserId={currentUserId}
          receiverId={incomingCall?.receiverId ?? (callTarget ? otherUserId : null)}
          callType={incomingCall?.type ?? callTarget ?? "VOICE"}
          incomingCall={incomingCall ?? undefined}
          onClose={() => { setIncomingCall(null); setCallTarget(null); }}
        />
      )}
    </div>
  );
}
