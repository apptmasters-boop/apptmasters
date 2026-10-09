"use client";
/**
 * Household → Cleaning (docs/PRODUCT_LOGIC.md §8): one whole-home rotation with
 * three views — Rotation (whose turn, mark as cleaned), Schedule (next turns,
 * skipping people who'll be away) and History. Creating or deleting a rotation
 * is in a settings area for household admins only.
 */
import { BackLink } from "@/components/home/HomeNav";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const FREQS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TABS = ["rotation", "schedule", "history"] as const;
type Tab = (typeof TABS)[number];

interface RotationMember { id: string; name: string; traveling: boolean }
interface CleaningLog { id: string; photoUrl: string | null; notes: string | null; cleanedAt: string; cleanedBy: { id: string; name: string } }
interface Rotation {
  id: string; frequency: string; currentIndex: number; nextDue: string | null; dueWeekday: number | null;
  currentUserId: string; currentUserName: string; nextUserId: string; nextUserName: string;
  memberOrder: RotationMember[]; logs: CleaningLog[];
  schedule: { userId: string; name: string; due: string | null }[];
  pendingAdvanceById: string | null; pendingAdvanceByName: string | null;
  pendingSwap: { id: string; reason: string | null; requesterId: string; requesterName: string; targetId: string; targetName: string } | null;
}
interface SwapEvent { id: string; respondedAt: string; reason: string | null; requester: { id: string; name: string }; target: { id: string; name: string } }
interface Member { id: string; name: string }

const day = (iso: string, withWeekday = true) =>
  new Date(iso).toLocaleDateString("en-US", { ...(withWeekday ? { weekday: "short" } : {}), month: "short", day: "numeric" });
const primaryBtn = "rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

export default function CleaningPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rotation");
  const [history, setHistory] = useState<{ logs: CleaningLog[]; swaps: SwapEvent[] } | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapReason, setSwapReason] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ frequency: "WEEKLY" as string, memberIds: [] as string[], dueWeekday: null as number | null });
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  // "Mark as cleaned" dialog
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [doneNotes, setDoneNotes] = useState("");
  const [submitting, setSubmitting] = useState<"" | "uploading" | "saving">("");
  const [doneError, setDoneError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/cleaning`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]).then(async ([rotRes, aptRes, meRes]) => {
      if (!isCurrent()) return;
      if (rotRes.status === 401) { router.replace("/login"); return; }
      const rots: Rotation[] = rotRes.ok ? await rotRes.json() : [];
      const apt = aptRes.ok ? await aptRes.json() : null;
      const me = meRes.ok ? await meRes.json() : null;
      if (!isCurrent()) return;
      setRotations(rots);
      setSelectedId(prev => (prev && rots.some(r => r.id === prev) ? prev : rots[0]?.id ?? null));
      if (apt) {
        setMembers(apt.members.map((m: { user: Member }) => m.user));
        setIsAdmin(apt.currentUserRole === "ADMIN");
      }
      if (me) setCurrentUserId(me.id);
      setLoading(false);
    }).catch(() => { if (isCurrent()) setLoading(false); }), [apartmentId, router]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  // History loads when its tab is opened (and again after a new cleaning)
  useEffect(() => {
    if (tab !== "history" || !selectedId) return;
    let current = true;
    apiFetch(`/api/apartments/${apartmentId}/cleaning/${selectedId}/history`)
      .then(res => (res.ok ? res.json() : { logs: [], swaps: [] }))
      .then(data => { if (current) setHistory(data); })
      .catch(() => {});
    return () => { current = false; };
  }, [tab, selectedId, apartmentId, rotations]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;

  const rot = rotations.find(r => r.id === selectedId) ?? null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (form.memberIds.length < 2) return;
    setSaving(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/cleaning`, { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? "Could not create the rotation."); return; }
    setForm({ frequency: "WEEKLY", memberIds: [], dueWeekday: null });
    setShowSettings(false);
    load();
  }
  async function del(rotationId: string) {
    if (!confirm("Delete this cleaning rotation? Its history is deleted too.")) return;
    await apiFetch(`/api/apartments/${apartmentId}/cleaning/${rotationId}`, { method: "DELETE" });
    load();
  }
  async function resolveAdvance(rotationId: string, action: "approve" | "reject") {
    setResolving(true);
    await apiFetch(`/api/apartments/${apartmentId}/cleaning/${rotationId}/${action}-advance`, { method: "POST" });
    setResolving(false);
    load();
  }

  async function requestSwap(rotationId: string) {
    setSwapBusy(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/cleaning/${rotationId}/swap`, { method: "POST", body: JSON.stringify({ reason: swapReason || undefined }) });
    setSwapBusy(false);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? "Could not send the request."); return; }
    setSwapOpen(false); setSwapReason("");
    load();
  }
  async function answerSwap(swapId: string, action: "accept" | "decline" | "cancel") {
    setSwapBusy(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/cleaning/swaps/${swapId}`, { method: "POST", body: JSON.stringify({ action }) });
    setSwapBusy(false);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Something went wrong.");
    load();
  }

  function openDone(rotationId: string) {
    setDoneFor(rotationId); setPhotoFile(null); setPhotoPreview(null); setDoneNotes(""); setDoneError(null);
  }
  async function submitDone() {
    if (!doneFor) return;
    setDoneError(null);
    let photoUrl: string | undefined;
    if (photoFile) {
      setSubmitting("uploading");
      const fd = new FormData();
      fd.append("photo", photoFile);
      const up = await apiFetch("/api/upload/cleaning-photo", { method: "POST", body: fd });
      if (!up.ok) { setSubmitting(""); setDoneError((await up.json().catch(() => ({}))).error ?? "Photo upload failed"); return; }
      photoUrl = (await up.json()).url;
    }
    setSubmitting("saving");
    const res = await apiFetch(`/api/apartments/${apartmentId}/cleaning/${doneFor}`, {
      method: "POST", body: JSON.stringify({ photoUrl, notes: doneNotes || undefined }),
    });
    setSubmitting("");
    if (!res.ok) { setDoneError((await res.json().catch(() => null))?.error ?? "Something went wrong"); return; }
    setDoneFor(null);
    if (res.status === 202) alert("Sent to the household admins for approval.");
    load();
  }

  const toggleMember = (mid: string) => setForm(f => ({ ...f, memberIds: f.memberIds.includes(mid) ? f.memberIds.filter(m => m !== mid) : [...f.memberIds, mid] }));
  const moveMember = (mid: string, dir: -1 | 1) => setForm(f => {
    const arr = [...f.memberIds]; const i = arr.indexOf(mid); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return f;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...f, memberIds: arr };
  });

  const isMyTurn = !!rot && rot.currentUserId === currentUserId;
  const hasPending = !!rot?.pendingAdvanceById;
  const canMark = !!rot && (!rot.nextDue || new Date(rot.nextDue) <= new Date()) && !hasPending;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Cleaning</h1>
      <p className="mt-1 text-sm text-gray-500">Everyone takes turns cleaning the whole home.</p>

      {rotations.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="font-medium text-gray-800">No cleaning rotation yet</p>
          <p className="mt-1 text-sm text-gray-500">{isAdmin ? "Set one up below so everyone takes turns." : "Only household admins can set up the cleaning rotation."}</p>
        </div>
      ) : rot && (
        <>
          {rotations.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {rotations.map((r, i) => (
                <button key={r.id} onClick={() => { setSelectedId(r.id); setHistory(null); }} aria-pressed={r.id === rot.id}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${r.id === rot.id ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-700"}`}>
                  {FREQ_LABELS[r.frequency]} rotation {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
            {TABS.map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`rounded-lg py-2 text-sm font-medium capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === "rotation" && (
            <section className="mt-5 space-y-4">
              <div className={`rounded-2xl border px-5 py-5 ${isMyTurn ? "border-brand bg-brand text-white" : "border-gray-200 bg-white"}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isMyTurn ? "text-white/80" : "text-gray-500"}`}>{FREQ_LABELS[rot.frequency]} cleaning</p>
                <p className={`mt-1 text-xl font-bold ${isMyTurn ? "" : "text-gray-900"}`}>{isMyTurn ? "It's your turn to clean" : `${rot.currentUserName}'s turn`}</p>
                {rot.nextDue && <p className={`mt-0.5 text-sm ${isMyTurn ? "text-white/85" : "text-gray-500"}`}>Due {day(rot.nextDue)}</p>}
                <button onClick={() => openDone(rot.id)} disabled={!canMark}
                  className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 ${isMyTurn ? "bg-white text-brand" : "bg-brand text-white hover:bg-brand-dark"}`}>
                  {hasPending ? "Waiting for admin approval"
                    : !canMark && rot.nextDue ? `Done for now · next turn ${day(rot.nextDue, false)}`
                    : isMyTurn ? "Mark as cleaned" : "I cleaned instead (needs admin approval)"}
                </button>
              </div>

              {rot.pendingSwap ? (
                <div className="rounded-2xl border border-brand/30 bg-brand-soft/70 px-4 py-3 text-sm text-gray-800 dark:bg-brand/20">
                  {rot.pendingSwap.targetId === currentUserId ? (
                    <>
                      <p><span className="font-semibold">{rot.pendingSwap.requesterName}</span> can&apos;t clean this week and asked you to swap: you clean now, they take your next turn.</p>
                      {rot.pendingSwap.reason && <p className="mt-1 text-xs text-gray-600">Reason: {rot.pendingSwap.reason}</p>}
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => answerSwap(rot.pendingSwap!.id, "accept")} disabled={swapBusy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Accept</button>
                        <button onClick={() => answerSwap(rot.pendingSwap!.id, "decline")} disabled={swapBusy} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium">Decline</button>
                      </div>
                    </>
                  ) : rot.pendingSwap.requesterId === currentUserId ? (
                    <div className="flex items-center justify-between gap-3">
                      <p>Waiting for <span className="font-semibold">{rot.pendingSwap.targetName}</span> to answer your swap request.</p>
                      <button onClick={() => answerSwap(rot.pendingSwap!.id, "cancel")} disabled={swapBusy} className="text-xs font-medium text-red-600 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <p>{rot.pendingSwap.requesterName} asked {rot.pendingSwap.targetName} to swap this turn.</p>
                  )}
                </div>
              ) : isMyTurn && canMark && (
                <button onClick={() => setSwapOpen(true)} className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-900">
                  Can&apos;t clean this week?
                </button>
              )}

              {hasPending && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30">
                  {isAdmin ? (
                    <>
                      <p><span className="font-medium">{rot.pendingAdvanceByName}</span> says they cleaned out of turn.</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => resolveAdvance(rot.id, "approve")} disabled={resolving} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
                        <button onClick={() => resolveAdvance(rot.id, "reject")} disabled={resolving} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium">Decline</button>
                      </div>
                    </>
                  ) : (
                    <p>{rot.pendingAdvanceById === currentUserId ? "Your" : `${rot.pendingAdvanceByName}'s`} out-of-turn cleaning is waiting for admin approval.</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order</p>
                <ol className="mt-2 space-y-1.5">
                  {rot.memberOrder.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-2.5 text-sm">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${m.id === rot.currentUserId ? "bg-brand text-white" : "bg-gray-100 text-gray-600"}`}>{i + 1}</span>
                      <span className="flex-1 text-gray-800">{m.name}{m.id === currentUserId && " (you)"}</span>
                      {m.id === rot.currentUserId && <span className="text-xs font-medium text-brand">Now</span>}
                      {m.id === rot.nextUserId && m.id !== rot.currentUserId && <span className="text-xs text-gray-500">Next</span>}
                      {m.traveling && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">✈ Away · skipped</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {tab === "schedule" && (
            <section className="mt-5">
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {rot.schedule.map((t, i) => (
                  <li key={i} className={`flex items-center gap-3 px-4 py-3 ${t.userId === currentUserId ? "bg-brand-soft/60 dark:bg-brand/20" : ""}`}>
                    <span className="w-24 shrink-0 text-sm text-gray-500">{t.due ? day(t.due) : "Now"}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{t.name}{t.userId === currentUserId && " (you)"}</span>
                    {i === 0 && <span className="text-xs font-medium text-brand">Current turn</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">People marked as traveling on a date are skipped for that turn.</p>
            </section>
          )}

          {tab === "history" && (
            <section className="mt-5">
              {history === null ? <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
                : history.logs.length + history.swaps.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No cleanings recorded yet.</p>
                : (
                  <ul className="space-y-2">
                    {history.swaps.map(sw => (
                      <li key={sw.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">⇄</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900">{sw.target.name} took {sw.requester.name}&apos;s turn</span>
                          <span className="block text-xs text-gray-500">Swap · {day(sw.respondedAt)}{sw.reason ? ` · ${sw.reason}` : ""}</span>
                        </span>
                      </li>
                    ))}
                    {history.logs.map(log => (
                      <li key={log.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                        {log.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={log.photoUrl} alt="Cleaning photo" className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-brand/30">✓</span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900">{log.cleanedBy.name}</span>
                          <span className="block text-xs text-gray-500">{day(log.cleanedAt)}{log.notes ? ` · ${log.notes}` : ""}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <section className="mt-8">
          <button onClick={() => setShowSettings(s => !s)} aria-expanded={showSettings} className="text-sm font-medium text-gray-600 hover:text-gray-900">
            {showSettings ? "▾" : "▸"} Rotation settings (admins)
          </button>
          {showSettings && (
            <div className="mt-3 space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              {rot && (
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <p className="text-sm text-gray-700">Delete the {FREQ_LABELS[rot.frequency].toLowerCase()} rotation and its history.</p>
                  <button onClick={() => del(rot.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              )}
              <form onSubmit={create} className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">New rotation</p>
                <div className="flex gap-2">
                  {FREQS.map(f => (
                    <button key={f} type="button" onClick={() => setForm(p => ({ ...p, frequency: f }))} aria-pressed={form.frequency === f}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium ${form.frequency === f ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-700"}`}>
                      {FREQ_LABELS[f]}
                    </button>
                  ))}
                </div>
                {form.frequency === "WEEKLY" && (
                  <label className="block text-xs text-gray-600">
                    Cleaning day
                    <select value={form.dueWeekday ?? ""} onChange={e => setForm(p => ({ ...p, dueWeekday: e.target.value === "" ? null : Number(e.target.value) }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="">No fixed day (7 days from today)</option>
                      {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </label>
                )}
                <div>
                  <p className="text-xs text-gray-600">Members, in order</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {members.filter(m => !form.memberIds.includes(m.id)).map(m => (
                      <button key={m.id} type="button" onClick={() => toggleMember(m.id)} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:border-brand">+ {m.name}</button>
                    ))}
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {form.memberIds.map((mid, i) => (
                      <li key={mid} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                        <span className="w-5 text-xs font-bold text-gray-500">{i + 1}</span>
                        <span className="flex-1">{members.find(m => m.id === mid)?.name ?? mid}</span>
                        <button type="button" aria-label="Move up" onClick={() => moveMember(mid, -1)} disabled={i === 0} className="px-1 disabled:opacity-20">↑</button>
                        <button type="button" aria-label="Move down" onClick={() => moveMember(mid, 1)} disabled={i === form.memberIds.length - 1} className="px-1 disabled:opacity-20">↓</button>
                        <button type="button" aria-label="Remove" onClick={() => toggleMember(mid)} className="px-1 text-red-500">×</button>
                      </li>
                    ))}
                  </ol>
                  {form.memberIds.length < 2 && <p className="mt-1 text-xs text-gray-500">Add at least 2 people.</p>}
                </div>
                <button type="submit" disabled={saving || form.memberIds.length < 2} className={primaryBtn}>{saving ? "Creating…" : "Create rotation"}</button>
              </form>
            </div>
          )}
        </section>
      )}

      {swapOpen && rot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="swap-title">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
            <h2 id="swap-title" className="font-bold text-gray-900">Can&apos;t clean this week?</h2>
            <p className="text-sm text-gray-600">We&apos;ll ask <span className="font-semibold">{rot.nextUserName}</span> to swap: they clean now and you take their next turn. Nothing changes until they accept.</p>
            <input type="text" maxLength={300} placeholder="Reason (optional)" value={swapReason} onChange={e => setSwapReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => requestSwap(rot.id)} disabled={swapBusy} className={`flex-1 ${primaryBtn}`}>{swapBusy ? "Sending…" : "Ask to swap"}</button>
              <button onClick={() => setSwapOpen(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {doneFor && (() => {
        const mine = rotations.find(r => r.id === doneFor)?.currentUserId === currentUserId;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="done-title">
            <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
              <h2 id="done-title" className="font-bold text-gray-900">{mine ? "Mark as cleaned" : "I cleaned instead"}</h2>
              <p className="text-sm text-gray-600">
                {mine ? "Add a photo or note if you like. Then the next person's turn starts and it's saved in History."
                  : "It's not your turn, so a household admin approves this before the rotation moves on."}
              </p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="h-40 w-full rounded-xl border border-gray-200 object-cover" />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} aria-label="Remove photo"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white">×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-gray-300 py-6 text-sm font-medium text-gray-500 hover:border-brand hover:text-brand">
                  Add photo (optional)
                </button>
              )}
              <input type="text" placeholder="Note (optional)" value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {doneError && <p className="text-sm text-red-600">{doneError}</p>}
              <div className="flex gap-2">
                <button onClick={submitDone} disabled={!!submitting} className={`flex-1 ${primaryBtn}`}>
                  {submitting === "uploading" ? "Uploading…" : submitting === "saving" ? "Saving…" : mine ? "Done, next person's turn" : "Send for approval"}
                </button>
                <button onClick={() => setDoneFor(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
