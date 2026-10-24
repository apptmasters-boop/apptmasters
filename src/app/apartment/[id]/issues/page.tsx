"use client";
/**
 * More → Household issues (docs/PRODUCT_LOGIC.md §18; "Disputes" before Sprint
 * 10a). Raise a concern, discuss it, propose a resolution; the person who
 * raised it accepts or declines. Private issues are only seen by the person who
 * raised it, the person it involves and household admins. Rules: src/lib/issues.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/home/HomeNav";
import NotificationBell from "@/components/NotificationBell";
import { pageClass } from "@/components/home/useApartment";
import { apiFetch } from "@/lib/api";

interface Person { id: string; name: string }
interface Entry { id: string; kind: string; body: string; createdAt: string; user: Person }
interface Issue {
  id: string; title: string; description: string; status: string; category: string; isPrivate: boolean;
  proposal: string | null; proposedById: string | null; resolution: string | null; createdAt: string;
  raisedBy: Person; against: Person | null; comments: Entry[];
}
interface IssuesData { me: string; isAdmin: boolean; people: Person[]; issues: Issue[] }

const TOPICS: Record<string, string> = { NOISE: "Noise", CLEANING: "Cleaning", EXPENSES: "Shared expenses", RENT: "Rent", GUESTS: "Guests", OTHER: "Other" };
const STEP: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-amber-50 text-amber-800" },
  DISCUSSION: { label: "Discussion", cls: "bg-blue-50 text-blue-700" },
  PROPOSED: { label: "Proposed resolution", cls: "bg-indigo-50 text-indigo-700" },
  RESOLVED: { label: "Resolved", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "Closed", cls: "bg-gray-100 text-gray-600" },
};
const when = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const settled = (status: string) => status === "RESOLVED" || status === "CLOSED";

export default function IssuesPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<IssuesData | null>(null);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${apartmentId}/issues`)
      .then(async res => {
        if (!isCurrent()) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const json = await res.json();
        if (isCurrent()) setData(json);
      })
      .catch(() => { if (isCurrent()) setFailed(true); }), [apartmentId, router]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const open = data?.issues.filter(i => !settled(i.status)) ?? [];
  const done = data?.issues.filter(i => settled(i.status)) ?? [];

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Household issues</h1>
          <p className="mt-1 text-sm text-gray-500">Raise a concern and work it out together.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Raise an issue
        </button>
      </div>

      {failed && <p className="mt-6 text-sm text-red-600">Issues couldn&apos;t load. Try again in a minute.</p>}
      {!data && !failed && <p className="mt-6 text-sm text-gray-400">Loading…</p>}
      {data && showForm && <RaiseForm apartmentId={apartmentId} people={data.people} onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}

      {data && open.length === 0 && !showForm && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="font-medium text-gray-800">No open issues</p>
          <p className="mt-1 text-sm text-gray-500">If something bothers you at home, raise it here so it can be talked through.</p>
        </div>
      )}
      {data && open.length > 0 && (
        <ul className="mt-6 space-y-4">{open.map(i => <IssueCard key={i.id} issue={i} data={data} apartmentId={apartmentId} onChange={() => load()} />)}</ul>
      )}

      {done.length > 0 && data && (
        <section className="mt-8">
          <button onClick={() => setShowSettled(s => !s)} aria-expanded={showSettled} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Settled ({done.length}) {showSettled ? "▾" : "▸"}
          </button>
          {showSettled && <ul className="mt-3 space-y-4">{done.map(i => <IssueCard key={i.id} issue={i} data={data} apartmentId={apartmentId} onChange={() => load()} />)}</ul>}
        </section>
      )}
    </main>
  );
}

function IssueCard({ issue: i, data, apartmentId, onChange }: { issue: Issue; data: IssuesData; apartmentId: string; onChange: () => void }) {
  const [text, setText] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRaiser = i.raisedBy.id === data.me;
  const canClose = !settled(i.status) && (isRaiser || data.isAdmin);
  const name = (p: Person) => (p.id === data.me ? "You" : p.name);
  const proposer = i.comments.slice().reverse().find(c => c.kind === "PROPOSAL")?.user;

  async function act(action: string, body?: string) {
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/issues/${i.id}`, { method: "POST", body: JSON.stringify({ action, text: body ?? text }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again."); return; }
    setText(""); setDeclining(false);
    onChange();
  }

  const describe = (e: Entry) => {
    const who = name(e.user);
    switch (e.kind) {
      case "PROPOSAL": return <><span className="font-medium">{who}</span> proposed: &ldquo;{e.body}&rdquo;</>;
      case "DECLINED": return <><span className="font-medium">{who}</span> declined: {e.body}</>;
      case "ACCEPTED": return <><span className="font-medium">{who}</span> accepted the resolution.</>;
      case "CLOSED": return <><span className="font-medium">{who}</span> closed the issue{e.body ? `: ${e.body}` : "."}</>;
      default: return <><span className="font-medium">{who}:</span> {e.body}</>;
    }
  };

  return (
    <li className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {TOPICS[i.category] ?? "Other"}{i.isPrivate && " · 🔒 Private"}
          </p>
          <p className="mt-0.5 font-semibold text-gray-900">{i.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Raised by {name(i.raisedBy)} · {when(i.createdAt)}{i.against && ` · involves ${name(i.against)}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STEP[i.status]?.cls ?? ""}`}>{STEP[i.status]?.label ?? i.status}</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{i.description}</p>

      {i.status === "PROPOSED" && i.proposal && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-xs font-semibold text-indigo-800">Proposed resolution{proposer ? ` · ${name(proposer)}` : ""}</p>
          <p className="mt-0.5 text-sm text-indigo-900">&ldquo;{i.proposal}&rdquo;</p>
          {isRaiser && !declining && (
            <div className="mt-2 flex gap-2">
              <button onClick={() => act("accept", "")} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Accept</button>
              <button onClick={() => setDeclining(true)} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium">Decline</button>
            </div>
          )}
          {isRaiser && declining && (
            <div className="mt-2 space-y-2">
              <textarea rows={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Why doesn't this work for you?"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              <div className="flex gap-2">
                <button onClick={() => act("decline")} disabled={busy || !text.trim()} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Decline</button>
                <button onClick={() => setDeclining(false)} className="text-xs text-gray-600">Back</button>
              </div>
            </div>
          )}
          {!isRaiser && <p className="mt-1 text-xs text-indigo-700">Waiting for {i.raisedBy.name} to accept or decline.</p>}
        </div>
      )}
      {i.status === "RESOLVED" && i.resolution && (
        <p className="mt-3 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-900"><span className="font-semibold">Agreed:</span> {i.resolution}</p>
      )}

      {i.comments.length > 0 && (
        <ol className="mt-4 space-y-2 border-s-2 border-gray-100 ps-4">
          {i.comments.map(e => (
            <li key={e.id} className="text-sm text-gray-800">
              {describe(e)} <span className="text-xs text-gray-400">· {when(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}

      {!settled(i.status) && !declining && (
        <div className="mt-4 space-y-2">
          <textarea rows={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Reply, or write a resolution to suggest…"
            className="block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => act("reply")} disabled={busy || !text.trim()} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reply</button>
            {i.status !== "PROPOSED" && (
              <button onClick={() => act("propose")} disabled={busy || !text.trim()} className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand disabled:opacity-50">Suggest as the resolution</button>
            )}
            {canClose && (
              <button onClick={() => { const why = window.prompt("Close this issue? You can add a short reason (optional)."); if (why !== null) act("close", why); }}
                disabled={busy} className="ms-auto text-xs font-medium text-gray-500 hover:text-red-600">Close issue</button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </li>
  );
}

/** Raise an issue: topic, title, what's going on, who it involves (optional), private. */
function RaiseForm({ apartmentId, people, onDone, onCancel }: { apartmentId: string; people: Person[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ category: "NOISE", title: "", description: "", againstId: "", isPrivate: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/issues`, { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't raise the issue.");
  }

  const field = "mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand";
  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">Raise an issue</h2>
      <div>
        <p className="text-xs font-medium text-gray-700">Topic</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(TOPICS).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setForm(f => ({ ...f, category: key }))} aria-pressed={form.category === key}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${form.category === key ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-xs font-medium text-gray-700">Title
        <input type="text" required maxLength={120} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Music late at night" className={field} />
      </label>
      <label className="block text-xs font-medium text-gray-700">What&apos;s going on
        <textarea required rows={3} maxLength={2000} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe it calmly: what happens, when, and how it affects you." className={field} />
      </label>
      <label className="block text-xs font-medium text-gray-700">Who it involves (optional)
        <select value={form.againstId} onChange={e => setForm(f => ({ ...f, againstId: e.target.value }))} className={field}>
          <option value="">Nobody in particular</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.isPrivate} onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-brand" />
        <span>Private: only you, the person it involves and household admins can see it</span>
      </label>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Sending…" : "Raise it"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm text-gray-600">Cancel</button>
      </div>
    </form>
  );
}
