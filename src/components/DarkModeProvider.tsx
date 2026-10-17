"use client";
import { useEffect, useSyncExternalStore } from "react";

export default function DarkModeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return null;
}

function watchTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** The Dark mode switch on Settings (fix F13; it was on the profile page). Same "theme" key as above. */
export function useDarkMode(): [boolean, () => void] {
  const dark = useSyncExternalStore(watchTheme, () => document.documentElement.classList.contains("dark"), () => false);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage blocked: this visit only */ }
  }
  return [dark, toggle];
}
