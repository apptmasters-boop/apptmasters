"use client";
/**
 * More → Maintenance (docs/PRODUCT_LOGIC.md §14). Residents report problems;
 * each request shows its step (Reported → Acknowledged → Scheduled → In
 * progress → Completed → Resolved), the repair visit if one is scheduled, and
 * a timeline. When no landlord is linked to the home, household admins record
 * the landlord's answers here (owner's decision, 2026-10-15); a linked landlord
 * uses the manager portal. Rules: src/lib/maintenance.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/home/HomeNav";
import NotificationBell from "@/components/NotificationBell";
import { pageClass } from "@/components/home/useApartment";
import { apiFetch } from "@/lib/api";

interface Update {
  id: string; status: string; note: string | null; byRole: string; createdAt: string;
  scheduledStart: string | null; scheduledEnd: string | null; byUser: { name: string };
}
interface Request {
  id: string; title: string; description: string; priority: string; status: string; location: string | null;
  photo: string | null; scheduledStart: string | null; scheduledEnd: string | null; createdAt: string;
  submittedBy: { id: string; name: string }; updates: Update[]; next: string[];
  /** This person answers "Is it fixed?" (Sprint 8b). */
  canConfirm: boolean;
}
interface MaintenanceData { me: string; canUpdate: "HOUSEHOLD" | "LANDLORD" | null; landlord: { name: string } | null; rooms: string[]; requests: Request[] }

const STEPS = ["REPORTED", "ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"];
const LABEL: Record<string, string> = {
  REPORTED: "Reported", ACKNOWLEDGED: "Acknowledged", SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Completed", RESOLVED: "Resolved",
  REOPENED: "Still a problem", // timeline only: back to Reported after the resident's answer
};
const STATUS_STYLE: Record<string, string> = {
  REPORTED: "bg-amber-50 text-amber-800", ACKNOWLEDGED: "bg-blue-50 text-blue-700", SCHEDULED: "bg-indigo-50 text-indigo-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700", COMPLETED: "bg-green-50 text-green-700", RESOLVED: "bg-gray-100 text-gray-600",
};
const PRIORITY_STYLE: Record<string, string> = { LOW: "bg-gray-100 text-gray-600", MEDIUM: "bg-gray-100 text-gray-700", URGENT: "bg-red-50 text-red-700" };
const BY: Record<string, string> = { RESIDENT: "", HOUSEHOLD: "for the landlord", LANDLORD: "landlord" };

const when = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function visit(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${time(s)} – ${time(e)}`;
}

export default function MaintenancePage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${apartmentId}/maintenance`)
      .then(async res => {
        if (!isCurrent()) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace(`/apartment/${apartmentId}`); return; }
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

  const open = data?.requests.filter(r => r.status !== "RESOLVED") ?? [];
  const resolved = data?.requests.filter(r => r.status === "RESOLVED") ?? [];

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              {data.landlord
                ? `Your landlord, ${data.landlord.name}, updates requests in their portal.`
                : "No landlord is linked to this home, so household admins record the landlord's answers here."}
            </p>
          )}
        </div>
        <button onClick={() => setShowForm(s => !s)} className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          Report a problem
        </button>
      </div>

      {failed && <p className="mt-6 text-sm text-red-600">Maintenance couldn&apos;t load. Try again in a minute.</p>}
      {!data && !failed && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {data && showForm && <ReportForm apartmentId={apartmentId} rooms={data.rooms} onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}

      {data && open.length === 0 && !showForm && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="font-medium text-gray-800">Nothing needs fixing</p>
          <p className="mt-1 text-sm text-gray-500">Report a problem when something breaks.</p>
        </div>
      )}

      {data && open.length > 0 && (
        <ul className="mt-6 space-y-4">
          {open.map(r => <RequestCard key={r.id} request={r} data={data} apartmentId={apartmentId} onChange={() => load()} />)}
        </ul>
      )}

      {resolved.length > 0 && (
        <section className="mt-8">
          <button onClick={() => setShowResolved(s => !s)} className="text-xs font-semibold uppercase tracking-wide text-gray-500" aria-expanded={showResolved}>
            Resolved ({resolved.length}) {showResolved ? "▾" : "▸"}
          </button>
          {showResolved && data && (
            <ul className="mt-3 space-y-4">
              {resolved.map(r => <RequestCard key={r.id} request={r} data={data} apartmentId={apartmentId} onChange={() => load()} />)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function RequestCard({ request: r, data, apartmentId, onChange }: { request: Request; data: MaintenanceData; apartmentId: string; onChange: () => void }) {
  const [updating, setUpdating] = useState(false);
  const stepIndex = STEPS.indexOf(r.status);
  const canUpdate = data.canUpdate === "HOUSEHOLD" && r.next.length > 0;

  return (
    <li className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{r.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {r.location ? `${r.location} · ` : ""}Reported by {r.submittedBy.id === data.me ? "you" : r.submittedBy.name} · {when(r.createdAt)}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] ?? ""}`}>{LABEL[r.status] ?? r.status}</span>
          {r.priority !== "MEDIUM" && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[r.priority] ?? ""}`}>{r.priority === "URGENT" ? "Urgent" : "Low priority"}</span>}
        </span>
      </div>

      {stepIndex >= 0 && (
        <div className="mt-3 flex gap-1" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}: ${LABEL[r.status]}`}>
          {STEPS.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-brand" : "bg-gray-200"}`} />)}
        </div>
      )}

      <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{r.description}</p>
      {r.photo && (
        <a href={r.photo} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- user upload, size unknown */}
          <img src={r.photo} alt={`Photo of ${r.title}`} className="h-24 w-24 rounded-lg object-cover" />
        </a>
      )}

      {r.status === "SCHEDULED" && r.scheduledStart && r.scheduledEnd && (
        <p className="mt-3 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-800">Repair visit: {visit(r.scheduledStart, r.scheduledEnd)}</p>
      )}

      {r.updates.length > 0 && (
        <ol className="mt-4 space-y-2 border-s-2 border-gray-100 ps-4">
          {r.updates.map(u => (
            <li key={u.id} className="text-sm">
              <p className="text-gray-900">
                <span className="font-medium">{LABEL[u.status] ?? u.status}</span>
                <span className="text-gray-500"> · {u.byUser.name}{BY[u.byRole] ? ` (${BY[u.byRole]})` : ""} · {when(u.createdAt)}</span>
              </p>
              {u.scheduledStart && u.scheduledEnd && <p className="text-xs text-gray-600">Visit: {visit(u.scheduledStart, u.scheduledEnd)}</p>}
              {u.note && <p className="text-gray-700">{u.note}</p>}
            </li>
          ))}
        </ol>
      )}

      {r.canConfirm && <ConfirmFix request={r} apartmentId={apartmentId} onDone={onChange} />}

      {canUpdate && !updating && (
        <button onClick={() => setUpdating(true)} className="mt-4 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand">Update for the landlord</button>
      )}
      {canUpdate && updating && (
        <UpdateForm request={r} apartmentId={apartmentId} onDone={() => { setUpdating(false); onChange(); }} onCancel={() => setUpdating(false)} />
      )}
    </li>
  );
}

/** "Is it fixed?" (§14.5): the person who reported it says whether the completed repair worked. */
function ConfirmFix({ request, apartmentId, onDone }: { request: Request; apartmentId: string; onDone: () => void }) {
  const [notFixed, setNotFixed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(fixed: boolean) {
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/maintenance/${request.id}/confirm`, { method: "POST", body: JSON.stringify({ fixed, note }) });
    setBusy(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't send your answer.");
  }

  return (
    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="text-sm font-semibold text-gray-900">The repair is marked done. Is it fixed?</p>
      {!notFixed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => answer(true)} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Yes, it&apos;s fixed</button>
          <button onClick={() => setNotFixed(true)} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800">No, still a problem</button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-gray-600">What&apos;s still wrong?
            <textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. It still drips at night."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => answer(false)} disabled={busy || !note.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Send it back to the landlord</button>
            <button onClick={() => setNotFixed(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600">Back</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

/** A household admin records the landlord's answer: the next step, a note, and a visit time when scheduling. */
function UpdateForm({ request, apartmentId, onDone, onCancel }: { request: Request; apartmentId: string; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(request.next[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("12:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reschedule = request.status === "SCHEDULED";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const body: Record<string, unknown> = { status: step, note, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (step === "SCHEDULED") {
      // Local date and times → exact moments, so everyone sees the visit in their own time.
      body.scheduledStart = date ? new Date(`${date}T${from}`).toISOString() : null;
      body.scheduledEnd = date ? new Date(`${date}T${to}`).toISOString() : null;
    }
    const res = await apiFetch(`/api/apartments/${apartmentId}/maintenance/${request.id}/progress`, { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the update.");
  }

  const field = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900";
  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">What did the landlord say?</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="New step">
        {request.next.map(s => (
          <button key={s} type="button" role="radio" aria-checked={step === s} onClick={() => setStep(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${step === s ? "border-brand bg-brand text-white" : "border-gray-300 bg-white text-gray-700"}`}>
            {s === "SCHEDULED" && reschedule ? "New visit time" : LABEL[s]}
          </button>
        ))}
      </div>
      {step === "SCHEDULED" && (
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gray-500">Day<input type="date" required value={date} onChange={e => setDate(e.target.value)} className={field} /></label>
          <label className="text-xs text-gray-500">From<input type="time" required value={from} onChange={e => setFrom(e.target.value)} className={field} /></label>
          <label className="text-xs text-gray-500">To<input type="time" required value={to} onChange={e => setTo(e.target.value)} className={field} /></label>
        </div>
      )}
      <label className="block text-xs text-gray-500">Note (optional)
        <textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. A plumber is coming; someone needs to be home." className={field} />
      </label>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-gray-600">Cancel</button>
      </div>
    </form>
  );
}

/** Report a problem (§14.1): what, details, where, priority, optional photo. */
function ReportForm({ apartmentId, rooms, onDone, onCancel }: { apartmentId: string; rooms: string[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", location: "", priority: "MEDIUM" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await apiFetch("/api/upload/maintenance-photo", { method: "POST", body: fd });
    if (res.ok) setPhoto((await res.json()).url);
    else setError((await res.json().catch(() => ({}))).error ?? "The photo couldn't be uploaded.");
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/maintenance`, {
      method: "POST",
      body: JSON.stringify({ ...form, location: form.location || undefined, photo: photo ?? undefined }),
    });
    setSaving(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't send the request.");
  }

  const field = "mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand";
  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">Report a problem</h2>
      <label className="block text-xs font-medium text-gray-700">What&apos;s wrong
        <input type="text" required maxLength={100} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Leaking faucet" className={field} />
      </label>
      <label className="block text-xs font-medium text-gray-700">Details
        <textarea required rows={3} maxLength={1000} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What happens, since when…" className={field} />
      </label>
      <label className="block text-xs font-medium text-gray-700">Where in the home
        <input type="text" maxLength={80} list="maintenance-rooms" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Bathroom" className={field} />
        <datalist id="maintenance-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
      </label>
      <div>
        <p className="text-xs font-medium text-gray-700">How urgent</p>
        <div className="mt-1 flex gap-2">
          {(["LOW", "MEDIUM", "URGENT"] as const).map(p => (
            <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))} aria-pressed={form.priority === p}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium ${form.priority === p ? "border-brand bg-brand-soft text-brand" : "border-gray-200 text-gray-600"}`}>
              {p === "LOW" ? "Can wait" : p === "MEDIUM" ? "Soon" : "Urgent"}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs font-medium text-gray-700">
        Photo (optional)
        {photo ? (
          <div className="mt-1 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload, size unknown */}
            <img src={photo} alt="The problem" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-gray-500 underline">Remove</button>
          </div>
        ) : (
          <label className="mt-1 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-600">
            {uploading ? "Uploading…" : "Take or choose a photo"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={e => upload(e.target.files?.[0])} />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || uploading} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Sending…" : "Send"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm text-gray-600">Cancel</button>
      </div>
    </form>
  );
}
