"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const FREQS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };

interface RotationMember { id: string; name: string; traveling: boolean }
interface Rotation {
  id: string; name: string; frequency: string; currentIndex: number;
  nextDue: string | null;
  currentUserId: string; currentUserName: string;
  nextUserId: string; nextUserName: string;
  memberOrder: RotationMember[];
}
interface Member { id: string; name: string }

export default function CleaningPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ frequency: "WEEKLY" as string, memberIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const [rotRes, aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/cleaning`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (rotRes.status === 401) { router.replace("/login"); return; }
    setRotations(await rotRes.json());
    if (aptRes.ok) {
      const apt = await aptRes.json();
      setMembers(apt.members.map((m: { user: Member }) => m.user));
    }
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (form.memberIds.length < 2) return;
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/cleaning`, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ frequency: "WEEKLY", memberIds: [] });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function advance(rotationId: string) {
    setAdvancing(rotationId);
    await apiFetch(`/api/apartments/${apartmentId}/cleaning/${rotationId}`, { method: "POST" });
    setAdvancing(null);
    load();
  }

  async function del(rotationId: string) {
    if (!confirm("Delete this cleaning rotation?")) return;
    setDeleting(rotationId);
    await apiFetch(`/api/apartments/${apartmentId}/cleaning/${rotationId}`, { method: "DELETE" });
    setDeleting(null);
    load();
  }

  function toggleMember(id: string) {
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id)
        ? f.memberIds.filter(m => m !== id)
        : [...f.memberIds, id],
    }));
  }

  function moveMember(id: string, dir: -1 | 1) {
    setForm(f => {
      const arr = [...f.memberIds];
      const i = arr.indexOf(id);
      if (i < 0) return f;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return f;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, memberIds: arr };
    });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Cleaning Rotation</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + New rotation
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Create form */}
        {showForm && (
          <form onSubmit={create} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">New cleaning rotation</h3>

            <div>
              <label className="text-xs text-gray-500 mb-2 block font-medium">Frequency</label>
              <div className="flex gap-2">
                {FREQS.map(f => (
                  <button key={f} type="button"
                    onClick={() => setForm(prev => ({ ...prev, frequency: f }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.frequency === f
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                    }`}>
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-2 block font-medium">
                Select members & set order (click to add, arrows to reorder)
              </label>
              {/* Member picker */}
              <div className="flex flex-wrap gap-2 mb-3">
                {members.filter(m => !form.memberIds.includes(m.id)).map(m => (
                  <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                    className="text-xs border border-gray-300 rounded-full px-3 py-1 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                    + {m.name}
                  </button>
                ))}
              </div>
              {/* Ordered list */}
              {form.memberIds.length > 0 && (
                <div className="space-y-1.5">
                  {form.memberIds.map((id, i) => {
                    const name = members.find(m => m.id === id)?.name ?? id;
                    return (
                      <div key={id} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                        <span className="w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800 flex-1">{name}</span>
                        <button type="button" onClick={() => moveMember(id, -1)} disabled={i === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-lg leading-none">↑</button>
                        <button type="button" onClick={() => moveMember(id, 1)} disabled={i === form.memberIds.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-lg leading-none">↓</button>
                        <button type="button" onClick={() => toggleMember(id)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {form.memberIds.length < 2 && (
                <p className="text-xs text-gray-400 mt-2">Add at least 2 members</p>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving || form.memberIds.length < 2}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create rotation"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {/* Empty state */}
        {rotations.length === 0 && !showForm && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🧹</p>
            <p className="font-medium text-gray-600 mb-1">No cleaning rotation yet</p>
            <p className="text-sm mb-4">Set up a rotation so everyone takes turns cleaning the apartment.</p>
            <button onClick={() => setShowForm(true)}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              Create one
            </button>
          </div>
        )}

        {/* Rotation cards */}
        {rotations.map(rot => {
          const isMyTurn = rot.currentUserId === currentUserId;
          return (
            <div key={rot.id} className={`bg-white border rounded-2xl overflow-hidden ${
              isMyTurn ? "border-indigo-300 shadow-sm" : "border-gray-200"
            }`}>
              {/* Header */}
              <div className={`px-5 py-4 ${isMyTurn ? "bg-indigo-600" : "bg-gray-50 border-b border-gray-100"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isMyTurn ? "text-indigo-200" : "text-gray-400"}`}>
                      {FREQ_LABELS[rot.frequency]} cleaning
                    </p>
                    <p className={`font-bold text-lg ${isMyTurn ? "text-white" : "text-gray-900"}`}>
                      {isMyTurn ? "Your turn to clean!" : `${rot.currentUserName}'s turn`}
                    </p>
                    {rot.nextDue && (
                      <p className={`text-xs mt-0.5 ${isMyTurn ? "text-indigo-200" : "text-gray-400"}`}>
                        Due {new Date(rot.nextDue).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                    isMyTurn ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}>
                    {rot.currentUserName[0]?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Member order */}
              <div className="px-5 py-3">
                <p className="text-xs text-gray-400 font-medium mb-2">Rotation order</p>
                <div className="flex flex-wrap gap-2">
                  {rot.memberOrder.map((m, i) => (
                    <div key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                      m.id === rot.currentUserId
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : m.traveling
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>
                      <span className="font-bold">{i + 1}</span>
                      <span>{m.name}</span>
                      {m.traveling && <span>✈</span>}
                    </div>
                  ))}
                </div>
                {rot.memberOrder.some(m => m.traveling) && (
                  <p className="text-xs text-amber-600 mt-2">✈ Traveling members are skipped in the rotation.</p>
                )}
              </div>

              {/* Next up */}
              {rot.nextUserId !== rot.currentUserId && (
                <div className="px-5 pb-3">
                  <p className="text-xs text-gray-400">
                    Next up: <span className="font-medium text-gray-700">{rot.nextUserName}</span>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 pb-4 flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => advance(rot.id)} disabled={advancing === rot.id}
                  className="flex-1 text-sm bg-indigo-600 text-white py-2 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {advancing === rot.id ? "Advancing…" : isMyTurn ? "Mark done & pass to next" : "Advance rotation"}
                </button>
                <button onClick={() => del(rot.id)} disabled={deleting === rot.id}
                  className="text-sm text-red-400 hover:text-red-600 px-3 transition-colors">
                  {deleting === rot.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
