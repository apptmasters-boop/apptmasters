"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type View = "hidden" | "ask" | "signIn" | "looking";

/**
 * "Have you found your new home?" (Sprint 11a, PRODUCT_LOGIC §3.3), at the top
 * of Home when the question is due for the signed-in person (timing:
 * src/lib/housing.ts; it moved from Find a Home to Home in Sprint 13c). The
 * daily email links to Home with ?ask=home, so someone opening it signed out
 * is asked to sign in first.
 */
export default function HomeQuestionCard() {
  const router = useRouter();
  const [view, setView] = useState<View>("hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function load() {
      if (!getToken()) {
        if (new URLSearchParams(window.location.search).get("ask") === "home") setView("signIn");
        return;
      }
      const res = await apiFetch("/api/users/home-search");
      if (!res.ok) return;
      const data = await res.json();
      if (current && data.ask) setView("ask");
    }
    load();
    return () => { current = false; };
  }, []);

  async function answer(choice: "LOOKING" | "FOUND") {
    setBusy(true);
    setError("");
    const res = await apiFetch("/api/users/home-search", { method: "POST", body: JSON.stringify({ answer: choice }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    if (data.next) { router.push(data.next); return; }
    setBusy(false);
    setView("looking");
  }

  if (view === "hidden") return null;

  if (view === "looking") {
    return (
      <p role="status" className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600">
        Good luck with the search! We&apos;ll check in again in two weeks.
      </p>
    );
  }

  return (
    <section aria-labelledby="home-question" className="mb-6 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3.5 sm:px-5 sm:py-4">
      <h2 id="home-question" className="text-base font-semibold text-gray-900">Have you found your new home?</h2>
      {view === "signIn" ? (
        <>
          <p className="mt-1 text-sm text-gray-600">Sign in to answer.</p>
          <Link href={`/login?returnTo=${encodeURIComponent("/")}`}
            className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Sign in
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">
            Once you have a place, set up your home with your roommates: rent, cleaning and shopping, shared.
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => answer("FOUND")} disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              Yes, I found a place
            </button>
            <button type="button" onClick={() => answer("LOOKING")} disabled={busy}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              I&apos;m still looking
            </button>
          </div>
        </>
      )}
    </section>
  );
}
