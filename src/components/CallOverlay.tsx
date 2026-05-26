"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const STUN_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

type CallSessionData = {
  id: string;
  type: "VOICE" | "VIDEO";
  status: string;
  offer: string;
  callerId: string;
  receiverId: string | null;
};

interface Props {
  apartmentId: string;
  currentUserId: string;
  receiverId: string | null;
  callType: "VOICE" | "VIDEO";
  onClose: () => void;
  incomingCall?: CallSessionData;
}

export default function CallOverlay({ apartmentId, currentUserId, receiverId, callType, incomingCall, onClose }: Props) {
  const [status, setStatus] = useState<"connecting" | "ringing" | "active" | "ended">("connecting");
  const [callId, setCallId] = useState<string | null>(incomingCall?.id ?? null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "VIDEO");
  const [duration, setDuration] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  async function hangUp() {
    if (callId) {
      await apiFetch(`/api/apartments/${apartmentId}/calls/${callId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ENDED" }),
      });
    }
    cleanup();
    setStatus("ended");
    setTimeout(onClose, 1000);
  }

  async function declineCall() {
    if (callId) {
      await apiFetch(`/api/apartments/${apartmentId}/calls/${callId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DECLINED" }),
      });
    }
    cleanup();
    setStatus("ended");
    setTimeout(onClose, 500);
  }

  async function startMedia() {
    const constraints = { audio: true, video: (incomingCall ? incomingCall.type : callType) === "VIDEO" };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  }

  async function createPeerConnection() {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;
    pc.ontrack = e => {
      if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
    };
    pc.onicecandidate = async e => {
      if (e.candidate && callId) {
        await apiFetch(`/api/apartments/${apartmentId}/calls/${callId}`, {
          method: "PATCH",
          body: JSON.stringify({ iceCandidate: e.candidate }),
        });
      }
    };
    return pc;
  }

  async function answerIncoming() {
    if (!incomingCall) return;
    try {
      setStatus("connecting");
      setCallId(incomingCall.id);
      const stream = await startMedia();
      const pc = await createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(JSON.parse(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await apiFetch(`/api/apartments/${apartmentId}/calls/${incomingCall.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE", answer: JSON.stringify(answer) }),
      });

      pollRef.current = setInterval(async () => {
        if (!incomingCall.id) return;
        const r = await apiFetch(`/api/apartments/${apartmentId}/calls/${incomingCall.id}`);
        if (!r.ok) return;
        const updated = await r.json();
        if (updated.status === "DECLINED" || updated.status === "ENDED") {
          clearInterval(pollRef.current!);
          setStatus("ended");
          setTimeout(onClose, 1500);
          return;
        }
        const ice: RTCIceCandidateInit[] = JSON.parse(updated.callerIce || "[]");
        for (const c of ice) {
          try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }
      }, 1500);

      setStatus("active");
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      setStatus("ended");
      setTimeout(onClose, 1000);
    }
  }

  async function initOutgoing() {
    try {
      const stream = await startMedia();
      const pc = await createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await apiFetch(`/api/apartments/${apartmentId}/calls`, {
        method: "POST",
        body: JSON.stringify({ type: callType, receiverId, offer: JSON.stringify(offer) }),
      });
      const call = await res.json();
      setCallId(call.id);
      setStatus("ringing");

      pollRef.current = setInterval(async () => {
        const r = await apiFetch(`/api/apartments/${apartmentId}/calls/${call.id}`);
        if (!r.ok) return;
        const updated = await r.json();

        if (updated.status === "DECLINED" || updated.status === "ENDED") {
          clearInterval(pollRef.current!);
          setStatus("ended");
          setTimeout(onClose, 1500);
          return;
        }

        if (updated.answer && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(JSON.parse(updated.answer));
          const ice: RTCIceCandidateInit[] = JSON.parse(updated.receiverIce || "[]");
          for (const c of ice) { try { await pc.addIceCandidate(c); } catch { /* ignore */ } }
          setStatus("active");
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
          clearInterval(pollRef.current!);
        }
      }, 1500);
    } catch {
      setStatus("ended");
      setTimeout(onClose, 1000);
    }
  }

  useEffect(() => {
    if (incomingCall) {
      setStatus("ringing");
      return cleanup;
    }
    initOutgoing();
    return cleanup;
  }, []);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !micOn; setMicOn(m => !m); }
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !camOn; setCamOn(c => !c); }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  const displayType = incomingCall ? incomingCall.type : callType;
  const isIncoming = Boolean(incomingCall);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-between py-12">
      {displayType === "VIDEO" && (
        <video ref={remoteRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-80" />
      )}

      <div className="relative z-10 text-center">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">
          {incomingCall ? "?" : receiverId ? "?" : "G"}
        </div>
        <p className="text-white font-semibold text-lg">
          {incomingCall ? (incomingCall.receiverId ? "Incoming call" : "Incoming group call") : (receiverId ? "Direct call" : "Group call")}
        </p>
        <p className="text-gray-300 text-sm mt-1">
          {status === "connecting" && "Connecting…"}
          {status === "ringing" && (incomingCall ? "Incoming…" : "Ringing…")}
          {status === "active" && fmt(duration)}
          {status === "ended" && "Call ended"}
        </p>
      </div>

      {displayType === "VIDEO" && (
        <video ref={localRef} autoPlay playsInline muted
          className="absolute bottom-32 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white z-10" />
      )}

      <div className="relative z-10 flex items-center gap-4">
        <button onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-gray-700 text-white" : "bg-white text-gray-900"}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {micOn
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            }
          </svg>
        </button>

        {displayType === "VIDEO" && (
          <button onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${camOn ? "bg-gray-700 text-white" : "bg-white text-gray-900"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {isIncoming ? (
          <>
            <button onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors">
              <span className="text-white text-sm font-semibold">Decline</span>
            </button>
            <button onClick={answerIncoming}
              className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors">
              <span className="text-white text-sm font-semibold">Answer</span>
            </button>
          </>
        ) : (
          <button onClick={hangUp}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
