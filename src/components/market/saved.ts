"use client";
/**
 * Which listings the person has saved (Sprint 12; MARKETPLACE_FLOW.md §10,
 * §14), shared by every heart on the page. A visitor who taps Save signs up or
 * in and comes back to the same page with `?save=<listing>`, which
 * `completeSaveIntent` finishes (§10: "the Save action is completed").
 */
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

let ids = new Set<string>();
let ready = false;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => { ids = new Set(ids); listeners.forEach(l => l()); };

export function loadSaved(signedIn: boolean) {
  if (!signedIn || loaded) return loaded ?? Promise.resolve();
  loaded = apiFetch("/api/saved?ids=1")
    .then(async res => { if (res.ok) { ids = new Set((await res.json()).ids as string[]); ready = true; emit(); } })
    .catch(() => { loaded = null; });
  return loaded;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const EMPTY = new Set<string>();

/** The saved listing ids (empty for visitors and until loaded). */
export function useSavedIds(): Set<string> {
  return useSyncExternalStore(subscribe, () => ids, () => EMPTY);
}

/** Whether the saved list has loaded (before that, every heart is empty). */
export function useSavedReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

/** Save or unsave; the heart changes at once and goes back if the server says no. */
export async function toggleSaved(listingId: string): Promise<boolean> {
  const wasSaved = ids.has(listingId);
  if (wasSaved) ids.delete(listingId); else ids.add(listingId);
  emit();
  const res = await (wasSaved
    ? apiFetch(`/api/saved/${listingId}`, { method: "DELETE" })
    : apiFetch("/api/saved", { method: "POST", body: JSON.stringify({ listingId }) })).catch(() => null);
  if (!res?.ok) {
    if (wasSaved) ids.add(listingId); else ids.delete(listingId);
    emit();
    return wasSaved;
  }
  return !wasSaved;
}

/** Where a visitor goes to save: sign up (or sign in), then back here with the save finished. */
export function saveSignInPath(listingId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("save", listingId);
  return `/signup?returnTo=${encodeURIComponent(url.pathname + url.search)}`;
}

/** After signing in for a save: save it, then tidy the address. Returns true when something was saved. */
export async function completeSaveIntent(): Promise<boolean> {
  const url = new URL(window.location.href);
  const listingId = url.searchParams.get("save");
  if (!listingId) return false;
  url.searchParams.delete("save");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  if (ids.has(listingId)) return true;
  const res = await apiFetch("/api/saved", { method: "POST", body: JSON.stringify({ listingId }) }).catch(() => null);
  if (!res?.ok) return false;
  ids.add(listingId);
  emit();
  return true;
}
