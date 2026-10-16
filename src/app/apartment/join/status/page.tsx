"use client";
/**
 * Join status (Home Setup, Sprint 11b; design docs/mockups/join-home-mobile.jpg):
 * the requests waiting for a household admin's answer. People waiting land
 * here after signing in (landingPath in src/lib/housing.ts).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { SetupPage, SetupHeader, SetupCard, RequestTimeline, primaryButton, longDate } from "@/components/homeSetup/SetupShell";
import { ChevronRightIcon, HomeIcon, InfoIcon, SearchIcon } from "@/components/landing/icons";

interface JoinRequest { id: string; role: string; requestedAt: string; moveInDate: string | null; homeName: string; homeAddress: string | null }

export default function JoinStatusPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace(`/login?returnTo=${encodeURIComponent("/apartment/join/status")}`); return; }
    let current = true;
    async function load() {
      const res = await apiFetch("/api/apartments/join/requests");
      if (!current) return;
      if (!res.ok) { setFailed(true); return; }
      const data = await res.json();
      if (current) setRequests(data);
    }
    load();
    return () => { current = false; };
  }, [router]);

  return (
    <SetupPage>
      <SetupHeader title="Join status" subtitle="Track your requests to join a home." backHref="/listings" />

      {failed && <p className="mt-8 text-center text-sm text-gray-500">Couldn&apos;t load your requests. Please refresh.</p>}
      {!failed && requests === null && <p className="mt-8 text-center text-sm text-gray-400">Loading…</p>}

      {requests?.length === 0 && (
        <SetupCard>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300">No requests waiting for an answer.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/apartment/join" className={primaryButton}>Join a Home</Link>
            <Link href="/apartment/create"
              className="flex w-full items-center justify-center rounded-xl border border-brand/30 px-5 py-3.5 text-base font-semibold text-brand hover:bg-brand-soft dark:text-emerald-300 dark:hover:bg-brand/20">
              Create a Home
            </Link>
          </div>
        </SetupCard>
      )}

      {requests?.map(r => (
        <SetupCard key={r.id}>
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><HomeIcon className="h-6 w-6" /></span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900 dark:text-white">{r.homeName}</span>
              {r.homeAddress && <span className="block truncate text-xs text-gray-500">{r.homeAddress}</span>}
              <span className="block text-xs text-gray-500">
                {r.role === "GUEST" ? "As a guest" : "As a roommate"}{r.moveInDate ? ` · moving in on ${longDate(r.moveInDate)}` : ""}
              </span>
            </span>
          </div>
          <div className="pt-4"><RequestTimeline requestedAt={r.requestedAt} /></div>
        </SetupCard>
      ))}

      {requests && requests.length > 0 && (
        <>
          <div className="mt-5 flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/40">
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
            <span>
              <span className="block font-semibold text-sky-900 dark:text-sky-200">While you wait</span>
              <span className="block text-sky-800 dark:text-sky-300">You can keep searching for other apartments or rooms.</span>
            </span>
          </div>
          <Link href="/listings"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 shadow-sm hover:border-brand/40 dark:border-gray-800 dark:bg-gray-900 dark:text-white">
            <SearchIcon className="h-5 w-5 text-gray-500" /><span className="flex-1">Search other homes</span><ChevronRightIcon className="h-5 w-5 text-gray-400" />
          </Link>
        </>
      )}
    </SetupPage>
  );
}
