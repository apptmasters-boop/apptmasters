"use client";
/**
 * A listing's photos (step G1, owner 2026-10-18): they rotate on their own every 4
 * seconds with a soft fade, pause while the mouse, a finger or the keyboard is on them,
 * and stop for good once the person swipes, uses an arrow or taps a thumbnail (they're
 * in control then). A pause / play button lets anyone stop the movement (WCAG 2.2.2);
 * no rotation with "Reduce motion" or in a background tab. Swipe on phones, ‹ › on
 * larger screens, arrow keys when focused. Listing page only: cards stay still.
 *
 * `children` sit on top of the photo (Back, Save, Share).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HomeIcon } from "@/components/landing/icons";

const EVERY_MS = 4000;

function subscribeMedia(onChange: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => { m.removeEventListener("change", onChange); document.removeEventListener("visibilitychange", onChange); };
}
/** True when rotating would be unwelcome: "Reduce motion" is on, or the tab isn't visible. */
const stillWanted = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState !== "visible";

const Chevron = ({ left = false }: { left?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={left ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
  </svg>
);

export default function PhotoCarousel({ photos, alt, children }: { photos: { url: string }[]; alt: string; children?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);       // false once the person takes over, or presses pause
  const [holding, setHolding] = useState(false); // mouse, finger or keyboard focus on the photo
  const still = useSyncExternalStore(subscribeMedia, stillWanted, () => true);
  const touchX = useRef<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const many = photos.length > 1;
  const rotating = many && auto && !holding && !still;

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % photos.length), EVERY_MS);
    return () => clearInterval(timer);
  }, [rotating, photos.length]);

  // The thumbnail strip follows the photo shown (sideways only: never scrolls the page).
  useEffect(() => {
    const box = strip.current;
    const thumb = box?.children[index] as HTMLElement | undefined;
    if (box && thumb) box.scrollTo({ left: thumb.offsetLeft - box.clientWidth / 2 + thumb.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  /** The person chose a photo: they're in control, rotation stops. */
  const show = (i: number) => { setAuto(false); setIndex((i + photos.length) % photos.length); };

  return (
    <>
      <div className="relative">
        <div
          role={many ? "region" : undefined} aria-roledescription={many ? "carousel" : undefined} aria-label={many ? "Photos" : undefined}
          tabIndex={many ? 0 : undefined}
          onMouseEnter={() => setHolding(true)} onMouseLeave={() => setHolding(false)}
          // Keyboard focus pauses; a mouse click on Play or an arrow doesn't (it would never resume).
          onFocus={e => { if (e.target.matches(":focus-visible")) setHolding(true); }} onBlur={() => setHolding(false)}
          onKeyDown={e => { if (e.key === "ArrowRight") show(index + 1); if (e.key === "ArrowLeft") show(index - 1); }}
          onTouchStart={e => { touchX.current = e.touches[0].clientX; setHolding(true); }}
          onTouchEnd={e => {
            setHolding(false);
            const from = touchX.current;
            touchX.current = null;
            if (from === null) return;
            const dx = e.changedTouches[0].clientX - from;
            if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
          }}
          className="relative aspect-[4/3] overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:aspect-[16/9] lg:aspect-[16/10] lg:rounded-2xl dark:bg-gray-800">
          {photos.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-300"><HomeIcon className="h-14 w-14" /></div>
          ) : photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${i}:${p.url}`} src={p.url} alt={i === index ? alt : ""} aria-hidden={i !== index}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${i === index ? "opacity-100" : "opacity-0"}`} />
          ))}
          {many && (
            <>
              <button type="button" onClick={() => show(index - 1)} aria-label="Previous photo"
                className="absolute start-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white sm:flex">
                <Chevron left />
              </button>
              <button type="button" onClick={() => show(index + 1)} aria-label="Next photo"
                className="absolute end-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white sm:flex">
                <Chevron />
              </button>
              <div className="absolute bottom-3 end-3 flex items-center gap-2">
                <button type="button" onClick={() => setAuto(a => !a)} aria-label={auto ? "Pause photos" : "Play photos"}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                  {auto ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <span aria-live={rotating ? "off" : "polite"} className="rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white">{index + 1} / {photos.length}</span>
              </div>
            </>
          )}
        </div>
        {children}
      </div>
      {many && (
        <div ref={strip} className="flex gap-2 overflow-x-auto px-4 pt-2 lg:px-0">
          {photos.map((p, i) => (
            <button key={`${i}:${p.url}`} type="button" onClick={() => show(i)} aria-label={`Photo ${i + 1}`} aria-current={i === index}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-28 ${i === index ? "border-brand" : "border-transparent opacity-80"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
