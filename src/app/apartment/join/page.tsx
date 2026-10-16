"use client";
/**
 * Join a Home (Home Setup, Sprint 11b; MARKETPLACE_FLOW.md §23; design
 * docs/mockups/join-home-mobile.jpg): enter the invite code (filled in from an
 * invite email), review the home, add your move-in date, and ask to join. A
 * household admin approves; until then you stay a home seeker.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import {
  SetupPage, SetupHeader, Stepper, SetupCard, Field, ErrorNote, RequestTimeline, inputClass, primaryButton, textButton,
} from "@/components/homeSetup/SetupShell";
import {
  ArrowRightIcon, CalendarIcon, ChevronRightIcon, HomeIcon, InfoIcon, LinkIcon, MailIcon, PinIcon, SendIcon, UsersIcon, XIcon,
} from "@/components/landing/icons";

type Stage = "start" | "code" | "review" | "request" | "sent";
interface Preview { name: string; address: string | null; members: number; myStatus: string | null; apartmentId: string | null }

const STEPS = ["Enter code", "Review", "Request"];

function Illustration({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/20 dark:text-emerald-300">
      {children}
    </div>
  );
}

function HomeSummary({ home }: { home: Preview }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-soft to-emerald-50 text-brand dark:from-brand/30 dark:to-brand/10 dark:text-emerald-300">
        <HomeIcon className="h-12 w-12" />
      </div>
      <div className="space-y-2 p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{home.name}</h2>
        {home.address && (
          <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"><PinIcon className="mt-0.5 h-4 w-4 shrink-0" />{home.address}</p>
        )}
        <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <UsersIcon className="h-4 w-4 shrink-0" />{home.members} {home.members === 1 ? "member lives here" : "members live here"}
        </p>
      </div>
    </div>
  );
}

function JoinFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>("start");
  const [code, setCode] = useState("");
  const [home, setHome] = useState<Preview | null>(null);
  const [moveInDate, setMoveInDate] = useState("");
  const [role, setRole] = useState<"MEMBER" | "GUEST">("MEMBER");
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useCallback(async (value: string) => {
    setBusy(true);
    setError("");
    const res = await apiFetch(`/api/apartments/join?code=${encodeURIComponent(value.trim())}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Couldn't check this code. Please try again."); return false; }
    setHome(data);
    setStage("review");
    return true;
  }, []);

  // Signed out: sign in first and come back here. A code from an invite email is checked straight away.
  useEffect(() => {
    const fromLink = searchParams.get("code")?.toUpperCase() ?? "";
    if (!getToken()) {
      router.replace(`/login?returnTo=${encodeURIComponent(`/apartment/join${fromLink ? `?code=${fromLink}` : ""}`)}`);
      return;
    }
    if (!fromLink) return;
    let current = true;
    async function check() {
      setCode(fromLink);
      setStage("code");
      if (current) await preview(fromLink);
    }
    check();
    return () => { current = false; };
  }, [searchParams, router, preview]);

  async function sendRequest() {
    setBusy(true);
    setError("");
    const res = await apiFetch("/api/apartments/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: code.trim(), role, ...(moveInDate ? { moveInDate } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Couldn't send your request. Please try again."); return; }
    setSentAt(new Date());
    setStage("sent");
  }

  const stepIndex = stage === "code" ? 0 : stage === "review" ? 1 : 2;
  const goBack = () => {
    setError("");
    if (stage === "request") setStage("review");
    else if (stage === "review") setStage("code");
    else setStage("start");
  };

  if (stage === "sent" && home && sentAt) {
    return (
      <SetupPage>
        <SetupHeader title="Join a Home" backHref="/listings" />
        <Illustration><SendIcon className="h-12 w-12" /></Illustration>
        <div className="mt-5 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Request sent!</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            The household admin has been told about your request. You&apos;ll get an email once they answer.
          </p>
        </div>
        <SetupCard>
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><HomeIcon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900 dark:text-white">{home.name}</span>
              {home.address && <span className="block truncate text-xs text-gray-500">{home.address}</span>}
            </span>
          </div>
          <div className="pt-4"><RequestTimeline requestedAt={sentAt} /></div>
        </SetupCard>
        <div className="mt-6">
          <Link href="/listings" className={primaryButton}>Keep looking for a place</Link>
          <Link href="/apartment/join/status" className={textButton}>View my requests</Link>
        </div>
      </SetupPage>
    );
  }

  if (stage === "start") {
    return (
      <SetupPage>
        <SetupHeader title="Join a Home" subtitle="Become a member of a household." backHref="/listings" />
        <div className="mt-6 flex h-36 items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-brand-soft to-emerald-50 text-brand dark:from-brand/30 dark:to-brand/10 dark:text-emerald-300">
          <UsersIcon className="h-12 w-12" /><HomeIcon className="h-16 w-16" /><UsersIcon className="h-12 w-12" />
        </div>
        <button type="button" onClick={() => setStage("code")}
          className="mt-5 flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand/40 dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><LinkIcon className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900 dark:text-white">Join with an invite code</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">Enter the code your roommate or household admin shared.</span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400" />
        </button>
        <div className="mt-4 flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/40">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
          <span>
            <span className="block font-semibold text-sky-900 dark:text-sky-200">Don&apos;t have a code?</span>
            <span className="block text-sky-800 dark:text-sky-300">Ask your future roommates: their household admin finds the invite code on their home&apos;s Members page, and can email you an invitation.</span>
          </span>
        </div>
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Starting a new home?{" "}
          <Link href="/apartment/create" className="font-semibold text-brand hover:underline dark:text-emerald-300">Create a Home</Link>
        </p>
      </SetupPage>
    );
  }

  return (
    <SetupPage>
      <SetupHeader title="Join a Home"
        subtitle={stage === "code" ? "Enter the invitation code." : stage === "review" ? "Review the home information." : "Send your request to the household admin."}
        onBack={goBack} />
      <Stepper steps={STEPS} current={stepIndex} />

      {stage === "code" && (
        <form onSubmit={e => { e.preventDefault(); if (code.trim()) preview(code); }}>
          <Illustration><MailIcon className="h-12 w-12" /></Illustration>
          <SetupCard>
            <Field id="code" label="Invitation code" hint="Enter the code shared by your household admin (6 letters and numbers).">
              <input id="code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={12}
                autoCapitalize="characters" autoComplete="off" placeholder="AB7K9D"
                className={`${inputClass} font-mono text-base uppercase tracking-[0.25em]`} />
              {code && (
                <button type="button" onClick={() => setCode("")} aria-label="Clear code"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </Field>
          </SetupCard>
          <ErrorNote message={error} />
          <button type="submit" disabled={busy || !code.trim()} className={`${primaryButton} mt-6`}>
            {busy ? "Checking…" : "Next"} {!busy && <ArrowRightIcon className="h-5 w-5" />}
          </button>
        </form>
      )}

      {stage === "review" && home && (
        <>
          <div className="mt-5"><HomeSummary home={home} /></div>
          <ErrorNote message={error} />
          <div className="mt-6">
            {home.myStatus === "PENDING_APPROVAL" ? (
              <>
                <p className="mb-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">You&apos;ve already asked to join this home. The household admin will answer.</p>
                <Link href="/apartment/join/status" className={primaryButton}>View join status</Link>
              </>
            ) : home.myStatus && home.apartmentId ? (
              <>
                <p className="mb-3 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand dark:bg-brand/20 dark:text-emerald-200">You&apos;re already a member of this home.</p>
                <Link href={`/apartment/${home.apartmentId}`} className={primaryButton}>Open your home</Link>
              </>
            ) : (
              <button type="button" onClick={() => { setError(""); setStage("request"); }} className={primaryButton}>
                Request to join <ArrowRightIcon className="h-5 w-5" />
              </button>
            )}
            <button type="button" onClick={goBack} className={textButton}>Back</button>
          </div>
        </>
      )}

      {stage === "request" && home && (
        <>
          <SetupCard title={`Join ${home.name}`} subtitle="The household admin sees your name and email with your request.">
            <div className="space-y-5">
              <Field id="movein" label="Your move-in date" optional icon={<CalendarIcon className="h-5 w-5" />}
                hint="Until then, rent, cleaning and shopping turns and shared expenses leave you out. Leave it empty if you already live there.">
                <input id="movein" type="date" value={moveInDate} onChange={e => setMoveInDate(e.target.value)} className={`${inputClass} pl-11`} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">Joining as</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["MEMBER", "Roommate", "You live here: rent, chores and shopping are shared with you."],
                    ["GUEST", "Guest", "A short stay: you can see the home, without messaging or calls."],
                  ] as const).map(([value, title, detail]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
                      role === value ? "border-brand bg-brand-soft/60 dark:bg-brand/20" : "border-gray-200 hover:border-gray-300 dark:border-gray-700"}`}>
                      <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </SetupCard>
          <ErrorNote message={error} />
          <div className="mt-6">
            <button type="button" onClick={sendRequest} disabled={busy} className={primaryButton}>
              {busy ? "Sending…" : "Send request"} {!busy && <ArrowRightIcon className="h-5 w-5" />}
            </button>
            <button type="button" onClick={goBack} className={textButton}>Back</button>
          </div>
        </>
      )}
    </SetupPage>
  );
}

export default function JoinHomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Loading…</div>}>
      <JoinFlow />
    </Suspense>
  );
}
