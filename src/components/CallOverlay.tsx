"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: ["turn:100.31.129.115:3478?transport=udp", "turn:100.31.129.115:3478?transport=tcp"],
      username: "apptmasters",
      credential: "Turn2024Secure!",
    },
  ],
};

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
  const [callError, setCallError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const localRef  = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  // Dedicated audio element — always in DOM, never display:none, so browser allows autoplay
  const audioRef  = useRef<HTMLAudioElement>(null);

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const addedCallerIce   = useRef<Set<string>>(new Set());
  const addedReceiverIce = useRef<Set<string>>(new Set());
  // Ref so onicecandidate always has the current call ID (state is stale in closures)
  const callIdRef        = useRef<string | null>(incomingCall?.id ?? null);
  // Buffer ICE candidates gathered before call ID is known (outgoing only)
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);

  const cleanup = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
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

  async function startMedia(type: "VOICE" | "VIDEO") {
    const constraints: MediaStreamConstraints = { audio: true };
    if (type === "VIDEO") constraints.video = true;
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  }

  function attachRemoteStream(stream: MediaStream, type: "VOICE" | "VIDEO") {
    if (type === "VIDEO") {
      if (remoteRef.current) {
        remoteRef.current.srcObject = stream;
        remoteRef.current.play().catch(() => {});
      }
    } else {
      // Use dedicated <audio> element — always in DOM and not display:none,
      // so browsers don't block autoplay the way they do for hidden <video>.
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {});
      }
    }
  }

  async function sendIceCandidate(id: string, candidate: RTCIceCandidate) {
    await apiFetch(`/api/apartments/${apartmentId}/calls/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ iceCandidate: candidate }),
    });
  }

  async function createPeerConnection(effectiveType: "VOICE" | "VIDEO") {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;

    pc.ontrack = e => {
      if (e.streams[0]) attachRemoteStream(e.streams[0], effectiveType);
    };

    pc.onicecandidate = async e => {
      if (!e.candidate) return;
      if (callIdRef.current) {
        // Call ID already known — send immediately
        await sendIceCandidate(callIdRef.current, e.candidate);
      } else {
        // Call ID not yet known (outgoing: waiting for POST response) — buffer it
        iceCandidateQueue.current.push(e.candidate);
      }
    };

    return pc;
  }

  async function answerIncoming() {
    if (!incomingCall) return;
    setCallError(null);
    setStatus("connecting");

    // Step 1: get mic/camera separately so we can show a clear error if denied
    let stream: MediaStream;
    try {
      stream = await startMedia(incomingCall.type);
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      console.error("[Call] getUserMedia failed:", err);
      const msg = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Microphone access denied — allow mic in browser settings"
        : `Mic error: ${name}`;
      setCallError(msg);
      setStatus("ended");
      setTimeout(onClose, 4000);
      return;
    }

    // Step 2: WebRTC negotiation
    try {
      const pc = await createPeerConnection(incomingCall.type);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offerInit = typeof incomingCall.offer === "string"
        ? JSON.parse(incomingCall.offer)
        : incomingCall.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offerInit));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await apiFetch(`/api/apartments/${apartmentId}/calls/${incomingCall.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE", answer: JSON.stringify(answer) }),
      });

      setStatus("active");
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      pollRef.current = setInterval(async () => {
        const r = await apiFetch(`/api/apartments/${apartmentId}/calls/${incomingCall.id}`);
        if (!r.ok) return;
        const updated = await r.json();
        if (updated.status === "DECLINED" || updated.status === "ENDED") {
          clearInterval(pollRef.current!);
          cleanup();
          setStatus("ended");
          setTimeout(onClose, 1500);
          return;
        }
        const ice: RTCIceCandidateInit[] = JSON.parse(updated.callerIce || "[]");
        for (const c of ice) {
          const key = JSON.stringify(c);
          if (!addedCallerIce.current.has(key)) {
            addedCallerIce.current.add(key);
            try { await pc.addIceCandidate(c); } catch { /* stale — safe to ignore */ }
          }
        }
      }, 1500);
    } catch (err) {
      console.error("[Call] answerIncoming WebRTC error:", err);
      stream.getTracks().forEach(t => t.stop());
      cleanup();
      setCallError("Connection failed — please try again");
      setStatus("ended");
      setTimeout(onClose, 3000);
    }
  }

  async function initOutgoing() {
    try {
      const stream = await startMedia(callType);
      const pc = await createPeerConnection(callType);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // NOTE: ICE candidates may start arriving NOW, before call ID is known.
      // onicecandidate buffers them in iceCandidateQueue until the ID is set below.

      const res = await apiFetch(`/api/apartments/${apartmentId}/calls`, {
        method: "POST",
        body: JSON.stringify({ type: callType, receiverId, offer: JSON.stringify(offer) }),
      });
      const call = await res.json();

      // Set ref first so any future onicecandidate sends immediately
      callIdRef.current = call.id;
      setCallId(call.id);
      setStatus("ringing");

      // Flush any ICE candidates that were buffered while waiting for the call ID
      const queued = iceCandidateQueue.current.splice(0);
      for (const c of queued) {
        sendIceCandidate(call.id, c).catch(() => {});
      }

      pollRef.current = setInterval(async () => {
        const r = await apiFetch(`/api/apartments/${apartmentId}/calls/${call.id}`);
        if (!r.ok) return;
        const updated = await r.json();

        if (updated.status === "DECLINED" || updated.status === "ENDED") {
          clearInterval(pollRef.current!);
          cleanup();
          setStatus("ended");
          setTimeout(onClose, 1500);
          return;
        }

        if (updated.answer && pc.signalingState === "have-local-offer") {
          try {
            const answerInit = typeof updated.answer === "string"
              ? JSON.parse(updated.answer)
              : updated.answer;
            await pc.setRemoteDescription(new RTCSessionDescription(answerInit));
            setStatus("active");
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
          } catch (e) {
            console.error("[Call] setRemoteDescription (answer) error:", e);
          }
        }

        if (pc.remoteDescription) {
          const ice: RTCIceCandidateInit[] = JSON.parse(updated.receiverIce || "[]");
          for (const c of ice) {
            const key = JSON.stringify(c);
            if (!addedReceiverIce.current.has(key)) {
              addedReceiverIce.current.add(key);
              try { await pc.addIceCandidate(c); } catch { /* stale — safe to ignore */ }
            }
          }
        }
      }, 1500);
    } catch (err) {
      console.error("[Call] initOutgoing error:", err);
      cleanup();
      setCallError("Could not start call — check mic permissions");
      setStatus("ended");
      setTimeout(onClose, 3000);
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
  const isIncoming  = Boolean(incomingCall);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-between py-12">
      {/* Remote video — only shown for VIDEO calls */}
      <video ref={remoteRef} autoPlay playsInline
        className={displayType === "VIDEO" ? "absolute inset-0 w-full h-full object-cover opacity-80" : "hidden"} />

      {/* Dedicated audio element for VOICE calls — always rendered, never display:none,
          so browsers don't block autoplay on hidden elements */}
      <audio ref={audioRef} autoPlay playsInline />

      <div className="relative z-10 text-center">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">
          {incomingCall ? "?" : receiverId ? "?" : "G"}
        </div>
        <p className="text-white font-semibold text-lg">
          {incomingCall
            ? (incomingCall.receiverId ? "Incoming call" : "Incoming group call")
            : (receiverId ? "Direct call" : "Group call")}
        </p>
        <p className="text-gray-300 text-sm mt-1">
          {status === "connecting" && "Connecting…"}
          {status === "ringing"    && (incomingCall ? "Incoming…" : "Ringing…")}
          {status === "active"     && fmt(duration)}
          {status === "ended"      && (callError ?? "Call ended")}
        </p>
      </div>

      {displayType === "VIDEO" && (
        <video ref={localRef} autoPlay playsInline muted
          className="absolute bottom-32 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white z-10" />
      )}

      <div className="relative z-10 flex items-center gap-4">
        <button onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="9" y="2" width="6" height="13" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
            {!micOn && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />}
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
