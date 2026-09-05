"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (blob: Blob, mimeType: string) => Promise<void>;
  onActiveChange?: (active: boolean) => void;
  sending?: boolean;
}

type State = "idle" | "recording" | "preview";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function AudioRecorder({ onSend, onActiveChange, sending }: Props) {
  const [state, setState]     = useState<State>("idle");
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blobData, setBlobData]     = useState<{ blob: Blob; mimeType: string } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function setActive(s: State) {
    setState(s);
    onActiveChange?.(s !== "idle");
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/mp4")              ? "audio/mp4"              :
        "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current   = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setPreviewUrl(URL.createObjectURL(blob));
        setBlobData({ blob, mimeType });
        setActive("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(100);
      setActive("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      // mic permission denied
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recorderRef.current?.stop();
  }

  function cancel() {
    if (state === "recording") {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlobData(null);
    setDuration(0);
    setActive("idle");
  }

  async function handleSend() {
    if (!blobData) return;
    await onSend(blobData.blob, blobData.mimeType);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlobData(null);
    setDuration(0);
    setActive("idle");
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors flex-shrink-0"
        title="Record voice message">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
    );
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  if (state === "recording") {
    return (
      <div className="flex-1 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className="text-sm font-mono font-medium text-gray-700 tabular-nums flex-shrink-0">
          {fmt(duration)}
        </span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-red-400 rounded-full animate-pulse" />
        </div>
        <button
          type="button"
          onClick={stopRecording}
          className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
        <button type="button" onClick={cancel}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          Cancel
        </button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex items-center gap-2">
      {previewUrl && (
        <audio src={previewUrl} controls className="h-8 flex-1 min-w-0" style={{ maxWidth: 180 }} />
      )}
      <button type="button" onClick={cancel}
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
        Send
      </button>
    </div>
  );
}
