"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

interface RotationMember { id: string; name: string }
interface Rotation {
  id: string; itemName: string; frequency: string; currentIndex: number;
  lastBought: string | null; currentUserId: string; currentUserName: string;
  memberOrder: RotationMember[];
}
interface Member { id: string; name: string }

export default function RotationPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ itemName: "", frequency: "MONTHLY" as string, memberIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  async function load() {
    const [rotRes, aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/rotation`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (rotRes.status === 401) { router.replace("/login"); return; }
    setRotations(await rotRes.json());
    if (aptRes.ok) {
      const apt = await aptRes.json();
      setIsAdmin(apt.currentUserRole === "ADMIN");
      setMembers(apt.members.map((m: { user: Member }) => m.user));
    }
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function createRotation(e: React.FormEvent) {
    e.preventDefault();
    if (form.memberIds.length < 2) return;
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/rotation`, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ itemName: "", frequency: "MONTHLY", memberIds: [] });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function advance(rotationId: string) {
    setAdvancing(rotationId);
    await apiFetch(`/api/apartments/${apartmentId}/rotation/${rotationId}`, { method: "POST" });
    setAdvancing(null);
    load();
  }

  async function deleteRotation(rotationId: string) {
    if (!confirm("Delete this rotation?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/rotation/${rotationId}`, { method: "DELETE" });
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Purchase Rotation</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          {isAdmin && (
            <button onClick={() => setShowForm(s => !s)}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              + Rotation
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <p className="text-sm text-gray-500 px-1">
          Track whose turn it is to buy shared household items — toilet paper, dish soap, garbage bags, etc.
        </p>

        {/* Create form */}
        {showForm && (
          <form onSubmit={createRotation} className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">New rotation</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Item name</label>
              <input required type="text" placeholder="e.g. Toilet paper, Dish soap…" value={form.itemName}
                onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
              <div className="flex gap-2">
                {FREQUENCIES.map(freq => (
                  <button key={freq} type="button" onClick={() => setForm(f => ({ ...f, frequency: freq }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.frequency === freq ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {freq.charAt(0) + freq.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Members in rotation (select order)</label>
              <div className="space-y-1.5">
                {members.map((m, idx) => {
                  const pos = form.memberIds.indexOf(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${pos !== -1 ? "bg-blue-50 border-blue-300 text-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                      <span>{m.name}</span>
                      {pos !== -1 && <span className="text-xs font-bold text-blue-600">#{pos + 1}</span>}
                    </button>
                  );
                })}
              </div>
              {form.memberIds.length < 2 && <p className="text-xs text-gray-400 mt-1">Select at least 2 members</p>}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || form.memberIds.length < 2}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {rotations.length === 0 && !showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🔄</p>
            <p className="text-gray-400">No rotations set up yet.</p>
            {isAdmin && <p className="text-sm text-gray-400 mt-1">Create one to track who buys household items.</p>}
          </div>
        )}

        {rotations.map(rot => {
          const isMyTurn = rot.currentUserId === currentUserId;
          const daysAgo = rot.lastBought
            ? Math.floor((Date.now() - new Date(rot.lastBought).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return (
            <div key={rot.id} className={`bg-white border rounded-xl overflow-hidden ${isMyTurn ? "border-blue-300" : "border-gray-200"}`}>
              <div className={`px-5 py-4 ${isMyTurn ? "bg-blue-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{rot.itemName}</p>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {rot.frequency.charAt(0) + rot.frequency.slice(1).toLowerCase()}
                      </span>
                      {isMyTurn && (
                        <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                          Your turn!
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-medium">{rot.currentUserName}</span>
                      {isMyTurn ? " — it's your turn to buy this." : " — their turn to buy."}
                    </p>
                    {rot.lastBought ? (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Last bought {daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Never bought yet</p>
                    )}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteRotation(rot.id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors">×</button>
                  )}
                </div>

                {/* Rotation order */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {rot.memberOrder.map((m, i) => {
                    const isCurrent = i === rot.currentIndex % rot.memberOrder.length;
                    return (
                      <span key={m.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${isCurrent ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        {m.name}
                      </span>
                    );
                  })}
                </div>

                {/* Mark as bought */}
                <button onClick={() => advance(rot.id)} disabled={advancing === rot.id || !isMyTurn}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${isMyTurn ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-600"}`}>
                  {advancing === rot.id ? "Marking…" : isMyTurn ? "✓ I bought it — advance turn" : "Waiting for current buyer"}
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
