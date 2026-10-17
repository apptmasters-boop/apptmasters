"use client";
/**
 * Who is looking at a marketplace page (Sprint 12; MARKETPLACE_FLOW.md §2,
 * §13): a visitor (null), or a signed-in person with their homes. One request
 * per page load, shared by the header, the bottom bar and the page.
 */
import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

export interface Me {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  systemRole: string;
  foundHomeAt: string | null;
  /** Homes they live in (not a join request still waiting). */
  homes: { id: string; name: string; role?: string }[];
  /** A join request is waiting for a household admin. */
  pending: boolean;
  memberships: { status: string; role?: string; apartment: { id: string; name: string } }[];
  /** For My Profile and Settings (fix F13). */
  createdAt?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  roomAssignment?: string | null;
  moveInDate?: string | null;
  /** A JSON list of dietary keys, as stored. */
  dietaryFlags?: string;
}

let cache: { token: string; promise: Promise<Me | null> } | null = null;

function readToken() {
  try { return getToken(); } catch { return null; } // storage blocked: a visitor
}

export function loadMe(): Promise<Me | null> {
  const token = readToken();
  if (!token) return Promise.resolve(null);
  if (cache?.token !== token) {
    cache = {
      token,
      promise: apiFetch("/api/auth/me")
        .then(async res => {
          if (!res.ok) return null;
          const me = await res.json();
          const memberships: Me["memberships"] = me.memberships ?? [];
          return {
            ...me,
            memberships,
            homes: memberships.filter(m => m.status === "ACTIVE" || m.status === "VACATION").map(m => ({ id: m.apartment.id, name: m.apartment.name, role: m.role })),
            pending: memberships.some(m => m.status === "PENDING_APPROVAL"),
          } as Me;
        })
        .catch(() => null),
    };
  }
  return cache.promise;
}

export function forgetMe() { cache = null; }

const ME_CHANGED = "apptmasters:me-changed";

/** After you change your name or photo (fix F13): the header and the page load them again. */
export function refreshMe() {
  cache = null;
  window.dispatchEvent(new Event(ME_CHANGED));
}

/** `undefined` while loading, `null` for a visitor. */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    const load = () => { loadMe().then(m => { if (current) setMe(m); }); };
    load();
    window.addEventListener(ME_CHANGED, load);
    return () => { current = false; window.removeEventListener(ME_CHANGED, load); };
  }, []);
  return me;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
