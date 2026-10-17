"use client";
export const dynamic = "force-dynamic";
/**
 * Create a Home (Home Setup, Sprint 11b; PRODUCT_LOGIC §4, MARKETPLACE_FLOW.md
 * §22; design docs/mockups/create-home-mobile.jpg): basic info (with the
 * listing you found it through), roommates to invite, then a review. The
 * creator becomes the household admin; invitations go out once the home exists.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import {
  SetupPage, SetupHeader, Stepper, SetupCard, Field, ErrorNote, inputClass, primaryButton, textButton, longDate,
} from "@/components/homeSetup/SetupShell";
import { ArrowRightIcon, CalendarIcon, HomeIcon, MailIcon, PinIcon, UserPlusIcon, XIcon } from "@/components/landing/icons";

const STEPS = ["Basic info", "Members", "Review"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FoundListing { listingId: string; title: string; city: string }

export default function CreateHomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [found, setFound] = useState<FoundListing[]>([]);
  const [listingId, setListingId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace(`/login?returnTo=${encodeURIComponent("/apartment/create")}`); return; }
    let current = true;
    async function load() {
      const [meRes, inboxRes] = await Promise.all([apiFetch("/api/auth/me"), apiFetch("/api/listings/inbox")]);
      if (!current) return;
      if (meRes.ok) { const data = await meRes.json(); if (current) setMe({ name: data.name, email: data.email }); }
      if (inboxRes.ok) {
        const conversations: { listingId: string; listingTitle: string; listingCity: string; myListing: boolean }[] = await inboxRes.json();
        const seen = new Set<string>();
        const options = conversations.filter(c => !c.myListing && !seen.has(c.listingId) && seen.add(c.listingId))
          .map(c => ({ listingId: c.listingId, title: c.listingTitle, city: c.listingCity }));
        if (current) setFound(options);
      }
    }
    load();
    return () => { current = false; };
  }, [router]);

  const initials = useMemo(() => (me?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join(""), [me]);

  function pickListing(id: string) {
    setListingId(id);
    const listing = found.find(f => f.listingId === id);
    if (!listing) return;
    // The street address stays with the advertiser (shared in Messages): only the title and city fill in.
    setName(listing.title);
    setAddress(listing.city);
  }

  function next() {
    setError("");
    if (step === 0 && (!name.trim() || !address.trim())) { setError("Give your home a name and an address."); return; }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError("");
    if (step > 0) setStep(s => s - 1);
    else if (window.history.length > 1) router.back();
    else router.push("/listings");
  }

  function addInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteInput.trim().toLowerCase();
    if (!EMAIL.test(email)) { setError("Enter a valid email address."); return; }
    if (me && email === me.email.toLowerCase()) { setError("That's your own email."); return; }
    setError("");
    if (!invites.includes(email)) setInvites(list => [...list, email]);
    setInviteInput("");
  }

  async function create() {
    setBusy(true);
    setError("");
    const res = await apiFetch("/api/apartments", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), address: address.trim(), ...(moveInDate ? { moveInDate } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setError(data.error === "Invalid input" ? "Check the name, address and date." : data.error ?? "Couldn't create your home. Please try again."); return; }
    // Invitations go out now that the home exists (one at a time; a failed one can be re-sent from Members).
    for (const email of invites) {
      await apiFetch(`/api/apartments/${data.id}/invite-email`, { method: "POST", body: JSON.stringify({ email }) }).catch(() => null);
    }
    router.push(`/apartment/${data.id}`);
  }

  return (
    <SetupPage>
      <SetupHeader title="Create a Home" subtitle="Set up your home to share rent, expenses, cleaning and shopping with your roommates." onBack={back} />
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <SetupCard title="1. Basic information" subtitle="You can always update these details later.">
          <div className="space-y-4">
            {found.length > 0 && (
              <Field id="found" label="Found it on ApptMasters?" optional hint="Pick the listing you messaged its owner about: its title and city fill in.">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"><HomeIcon className="h-5 w-5" /></span>
                <select id="found" value={listingId} onChange={e => pickListing(e.target.value)} className={`${inputClass} pl-11`}>
                  <option value="">No, I found it elsewhere</option>
                  {found.map(f => <option key={f.listingId} value={f.listingId}>{f.title}{f.city ? ` · ${f.city}` : ""}</option>)}
                </select>
              </Field>
            )}
            <Field id="name" label="Home name" hint="Choose a name your roommates will recognize.">
              <input id="name" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="e.g. Prospect House" className={inputClass} />
            </Field>
            <Field id="address" label="Address" icon={<PinIcon className="h-5 w-5" />}
              hint={listingId ? "Add the street and apartment number: the advertiser shares them in Messages." : undefined}>
              <input id="address" value={address} onChange={e => setAddress(e.target.value)} maxLength={200}
                placeholder="123 Prospect Ave, Apt 3B, Brooklyn, NY 11216" autoComplete="street-address" className={`${inputClass} pl-11`} />
              {address && (
                <button type="button" onClick={() => setAddress("")} aria-label="Clear address"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </Field>
            <Field id="movein" label="Your move-in date" optional icon={<CalendarIcon className="h-5 w-5" />}
              hint="Until then, rent, cleaning and shopping turns and shared expenses leave you out. Leave it empty if you already live there.">
              <input id="movein" type="date" value={moveInDate} onChange={e => setMoveInDate(e.target.value)} className={`${inputClass} pl-11`} />
            </Field>
          </div>
        </SetupCard>
      )}

      {step === 1 && (
        <SetupCard title="2. Add household members" subtitle="Invite your roommates to join. You can skip this and invite them later.">
          <form onSubmit={addInvite} className="rounded-2xl border border-dashed border-brand/30 bg-brand-soft/40 p-4 dark:bg-brand/10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200">
                <UserPlusIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">Invite by email</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">They&apos;ll get an email with your home&apos;s invite code.</span>
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <label htmlFor="invite" className="sr-only">Email address</label>
              <input id="invite" type="email" value={inviteInput} onChange={e => setInviteInput(e.target.value)} placeholder="Enter an email address" className={inputClass} />
              <button type="submit" className="shrink-0 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">Invite</button>
            </div>
          </form>

          <h3 className="mt-5 text-sm font-semibold text-gray-800 dark:text-gray-200">Household members ({1 + invites.length})</h3>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            <li className="flex items-center gap-3 py-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">{initials || "?"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{me?.name ?? "You"} (you)</span>
                <span className="block text-xs text-gray-500">Creates the home</span>
              </span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand dark:bg-brand/30 dark:text-emerald-200">Household admin</span>
            </li>
            {invites.map(email => (
              <li key={email} className="flex items-center gap-3 py-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800"><MailIcon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{email}</span>
                  <span className="block text-xs text-gray-500">Invited (sent when you create the home)</span>
                </span>
                <button type="button" onClick={() => setInvites(list => list.filter(x => x !== email))} aria-label={`Remove ${email}`}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XIcon className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </SetupCard>
      )}

      {step === 2 && (
        <SetupCard title="3. Review" subtitle="Check everything, then create your home.">
          <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {[
              ["Home name", name.trim()],
              ["Address", address.trim()],
              ["Your move-in date", moveInDate ? longDate(`${moveInDate}T00:00:00Z`) : "I already live there"],
              ["Invitations", invites.length > 0 ? invites.join(", ") : "None yet: you can invite roommates later from Members"],
              ["Your role", "Household admin (you manage the home's settings and approve who joins)"],
            ].map(([term, value]) => (
              <div key={term} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
                <dt className="w-40 shrink-0 text-gray-500 dark:text-gray-400">{term}</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </SetupCard>
      )}

      <ErrorNote message={error} />

      <div className="mt-6">
        {step < 2 ? (
          <button type="button" onClick={next} className={primaryButton}>
            {step === 0 ? "Next: Members" : invites.length > 0 ? "Next: Review" : "Skip for now: Review"} <ArrowRightIcon className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={create} disabled={busy} className={primaryButton}>
            {busy ? "Creating your home…" : "Create My Home"} {!busy && <ArrowRightIcon className="h-5 w-5" />}
          </button>
        )}
        {step > 0 && <button type="button" onClick={back} className={textButton}>Back</button>}
      </div>

      <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Moving in with roommates who already use ApptMasters?{" "}
        <Link href="/apartment/join" className="font-semibold text-brand hover:underline dark:text-emerald-300">Join their home</Link>
      </p>
    </SetupPage>
  );
}
