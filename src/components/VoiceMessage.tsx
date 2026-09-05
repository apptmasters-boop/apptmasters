"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  src: string;
  isMe?: boolean;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function VoiceMessage({ src, isMe }: Props) {
  if (!src) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${
        isMe ? "bg-blue-600" : "bg-white border border-gray-200"
      }`}>
        <svg className={`w-4 h-4 flex-shrink-0 ${isMe ? "text-white/50" : "text-gray-300"}`}
          fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
        <span className={`text-xs ${isMe ? "text-white/50" : "text-gray-400"}`}>
          Voice message expired
        </span>
      </div>
    );
  }
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime    = () => setCurrentTime(audio.currentTime);
    const onMeta    = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
    const onEnded   = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate",      onTime);
    audio.addEventListener("loadedmetadata",  onMeta);
    audio.addEventListener("durationchange",  onMeta);
    audio.addEventListener("ended",           onEnded);
    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended",          onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play(); setPlaying(true); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  const progress = duration ? currentTime / duration : 0;
  const remaining = duration ? duration - currentTime : 0;

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl w-[200px] ${
      isMe ? "bg-blue-600" : "bg-white border border-gray-200"
    }`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isMe
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-blue-100 text-blue-600 hover:bg-blue-200"
        }`}>
        {playing ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div
          className="relative h-1.5 rounded-full cursor-pointer overflow-hidden"
          style={{ background: isMe ? "rgba(255,255,255,0.3)" : "#e5e7eb" }}
          onClick={seek}>
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress * 100}%`,
              background: isMe ? "white" : "#6366f1",
            }} />
        </div>
        <span className={`text-[10px] leading-none ${isMe ? "text-white/60" : "text-gray-400"}`}>
          {playing ? fmt(currentTime) : fmt(remaining || duration)}
        </span>
      </div>
    </div>
  );
}
