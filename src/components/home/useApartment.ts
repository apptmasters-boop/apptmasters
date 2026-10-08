"use client";
/**
 * Loads one apartment's details (members, house rules, your role) for the
 * Members, House rules and Home settings pages. One place for the request and
 * its types, so the three pages don't each repeat them.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface Member {
  id: string; role: string; status: string; joinedAt: string; expiresAt: string | null;
  user: { id: string; name: string; email: string; photo: string | null; roomAssignment: string | null; dietaryFlags: string };
}
export interface HouseRule {
  id: string; content: string; status: string; votingEndsAt: string | null;
  votes: { id: string; vote: string; user: { id: string; name: string } }[];
}
export interface ApartmentDetails {
  id: string; name: string; inviteCode: string;
  announcement: string | null; announcementAt: string | null;
  members: Member[]; houseRules: HouseRule[];
  currentUserRole: string; currentUserId: string;
}

export function useApartment(apartmentId: string) {
  const router = useRouter();
  const [apt, setApt] = useState<ApartmentDetails | null>(null);
  const [failed, setFailed] = useState(false);

  /** Fetches the details; `isCurrent` lets an effect ignore a response that arrives after unmount. */
  const fetchDetails = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${apartmentId}`)
      .then(async res => {
        if (!isCurrent()) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const data = await res.json();
        if (isCurrent()) setApt(data);
      })
      .catch(() => { if (isCurrent()) setFailed(true); }), [apartmentId, router]);

  useEffect(() => {
    let current = true;
    fetchDetails(() => current);
    return () => { current = false; };
  }, [fetchDetails]);

  const reload = useCallback(() => fetchDetails(), [fetchDetails]);

  return { apt, failed, reload, isAdmin: apt?.currentUserRole === "ADMIN", isGuest: apt?.currentUserRole === "GUEST" };
}

/** Page frame shared by the household pages: back link, title, optional subtitle. */
export const pageClass = "mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10";
