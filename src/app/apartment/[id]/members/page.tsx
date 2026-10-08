"use client";
/**
 * Household → Members: who lives here, inviting new people, travel status, and
 * leaving the home. Admin-only member management is in More → Home settings.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BackLink } from "@/components/home/HomeNav";
import { useApartment, pageClass } from "@/components/home/useApartment";
import { ChevronRightIcon } from "@/components/landing/icons";

interface Travel { id: string; userId: string; endDate: string | null }

const btn = "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50";

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apt, failed, isAdmin } = useApartment(id);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent">("idle");
  const [travelFor, setTravelFor] = useState<string | null>(null);
  const [travelForm, setTravelForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const loadTravels = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${id}/travel`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data && isCurrent()) setTravels(data); })
      .catch(() => {}), [id]);
  useEffect(() => {
    let current = true;
    loadTravels(() => current);
    return () => { current = false; };
  }, [loadTravels]);

  if (failed) return <p className="p-8 text-center text-sm text-gray-500">Couldn&apos;t load members. Please refresh.</p>;
  if (!apt) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;

  function copy(what: "code" | "link") {
    const text = what === "code" ? apt!.inviteCode : `${window.location.origin}/apartment/join?code=${apt!.inviteCode}`;
    navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(""), 2000);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteState("sending");
    await apiFetch(`/api/apartments/${id}/invite-email`, { method: "POST", body: JSON.stringify({ email: inviteEmail }) });
    setInviteEmail("");
    setInviteState("sent");
    setTimeout(() => setInviteState("idle"), 3000);
  }

  async function markTraveling() {
    setBusy(true);
    await apiFetch(`/api/apartments/${id}/travel`, {
      method: "POST",
      body: JSON.stringify({
        userId: travelFor,
        startDate: travelForm.startDate || new Date().toISOString(),
        endDate: travelForm.endDate || null,
        notes: travelForm.notes || null,
      }),
    });
    setTravelFor(null);
    setTravelForm({ startDate: "", endDate: "", notes: "" });
    setBusy(false);
    loadTravels();
  }

  async function markReturned(travelId: string) {
    setBusy(true);
    await apiFetch(`/api/apartments/${id}/travel/${travelId}`, { method: "PATCH", body: JSON.stringify({ returned: true }) });
    setBusy(false);
    loadTravels();
  }

  async function leaveHome() {
    const me = apt!.members.find(m => m.user.id === apt!.currentUserId);
    if (!me || !confirm("Leave this home? You'll lose access to its household, money and chat. This can't be undone.")) return;
    const res = await apiFetch(`/api/apartments/${id}/members/${me.id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? "Could not leave this home."); return; }
    router.replace("/dashboard");
  }

  return (
    <main className={pageClass}>
      <BackLink />
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Members</h1>
      <p className="mt-1 text-sm text-gray-500">{apt.members.length} {apt.members.length === 1 ? "person lives" : "people live"} in {apt.name}.</p>

      <section className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-4 dark:bg-brand/20">
        <div>
          <p className="text-xs font-medium text-gray-600">Invite code</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand dark:text-emerald-200">{apt.inviteCode}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={() => copy("code")} className="text-sm font-semibold text-brand hover:underline dark:text-emerald-200">{copied === "code" ? "Copied!" : "Copy code"}</button>
          <button onClick={() => copy("link")} className="text-xs text-gray-600 hover:underline">{copied === "link" ? "Link copied!" : "Copy invite link"}</button>
        </div>
      </section>

      {isAdmin && (
        <form onSubmit={sendInvite} className="mt-3 flex gap-2">
          <input type="email" required placeholder="Invite someone by email…" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
          <button type="submit" disabled={inviteState === "sending"}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {inviteState === "sent" ? "Sent!" : inviteState === "sending" ? "…" : "Invite"}
          </button>
        </form>
      )}

      <ul className="mt-6 space-y-2.5">
        {apt.members.map(m => {
          const travel = travels.find(t => t.userId === m.user.id);
          const isMe = m.user.id === apt.currentUserId;
          return (
            <li key={m.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <Link href={`/apartment/${id}/members/${m.user.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50">
                {m.user.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.photo} alt="" className="h-10 w-10 rounded-full border border-gray-200 object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">
                    {m.user.name[0]?.toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{m.user.name}{isMe && " (you)"}</span>
                    {m.role === "ADMIN" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Household admin</span>}
                    {m.role === "GUEST" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Guest</span>}
                    {travel && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        ✈ Traveling{travel.endDate ? ` until ${new Date(travel.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{m.user.roomAssignment ?? "No room assigned"}</span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
              {(isMe || isAdmin) && (
                <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-2.5">
                  {travel ? (
                    <button onClick={() => markReturned(travel.id)} disabled={busy} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-800`}>
                      Mark as back home
                    </button>
                  ) : (
                    <button onClick={() => setTravelFor(m.user.id)} className={`${btn} border-amber-200 bg-amber-50 text-amber-800`}>
                      ✈ Mark as traveling
                    </button>
                  )}
                  {isMe && <button onClick={leaveHome} className={`${btn} border-gray-200 text-red-600 hover:bg-red-50`}>Leave this home</button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {travelFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="travel-title">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
            <h2 id="travel-title" className="font-bold text-gray-900">Mark as traveling</h2>
            {(["startDate", "endDate"] as const).map(k => (
              <label key={k} className="block text-xs text-gray-600">
                {k === "startDate" ? "Leaving on" : "Back on (optional)"}
                <input type="date" value={travelForm[k]} onChange={e => setTravelForm(f => ({ ...f, [k]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
            ))}
            <label className="block text-xs text-gray-600">
              Note (optional)
              <input type="text" placeholder="Visiting family, work trip…" value={travelForm.notes} onChange={e => setTravelForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-gray-500">While away, the cleaning rotation skips this person and new equal-split expenses leave them out.</p>
            <div className="flex gap-2">
              <button onClick={markTraveling} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                {busy ? "Saving…" : "Confirm"}
              </button>
              <button onClick={() => setTravelFor(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
