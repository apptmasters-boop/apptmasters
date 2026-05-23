"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Member { id: string; name: string }
interface Chore {
  id: string; title: string; status: string; assignmentType: string; frequency: string;
  dueDate: string | null; points: number;
  assignedTo: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  photos: { id: string; url: string; takenAt: string }[];
  swapRequests: { id: string; fromUser: { name: string }; toUser: { name: string }; status: string }[];
}

const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly" };
const TYPE_LABELS: Record<string, string> = { ROTATING: "Rotating", FIXED: "Fixed", VOLUNTARY: "Voluntary" };

export default function RoomDetailPage() {
  const { id: apartmentId, roomId } = useParams<{ id: string; roomId: string }>();
  const router = useRouter();
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nudged, setNudged] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", assignmentType: "ROTATING", frequency: "WEEKLY", assignedUserId: "", dueDate: "", points: 2,
  });

  async function load() {
    const [roomsRes, choresRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/rooms`),
      apiFetch(`/api/apartments/${apartmentId}/chores`),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (roomsRes.status === 401) { router.replace("/login"); return; }
    const rooms = await roomsRes.json();
    const room = rooms.find((r: { id: string; name: string }) => r.id === roomId);
    if (room) setRoomName(room.name);
    const allChores: Chore[] = await choresRes.json();
    setChores(allChores.filter(c => c.status !== "DONE"));
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { user: Member }) => m.user));
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId, roomId]);

  async function addChore(e: React.FormEvent) {
    e.preventDefault();
    const { assignedUserId, dueDate, ...rest } = form;
    await apiFetch(`/api/apartments/${apartmentId}/chores`, {
      method: "POST",
      body: JSON.stringify({
        ...rest,
        roomId,
        ...(assignedUserId ? { assignedUserId } : {}),
        ...(dueDate ? { dueDate } : {}),
      }),
    });
    setForm({ title: "", assignmentType: "ROTATING", frequency: "WEEKLY", assignedUserId: "", dueDate: "", points: 2 });
    setShowAdd(false);
    load();
  }

  async function completeChore(choreId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/complete`, { method: "POST", body: "{}" });
    load();
  }

  async function nudge(choreId: string) {
    const res = await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/nudge`, { method: "POST" });
    const data = await res.json();
    setNudged(`Nudged ${data.assignee} about "${data.chore}"`);
    setTimeout(() => setNudged(null), 3000);
  }

  async function deleteChore(choreId: string) {
    if (!confirm("Delete this chore?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const roomChores = chores.filter(c => (c as unknown as { roomId: string }).roomId === roomId || true);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}/rooms`} className="text-sm text-gray-400 hover:text-gray-600">← Rooms</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{roomName}</span>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          + Add chore
        </button>
      </header>

      {nudged && (
        <div className="bg-indigo-600 text-white text-sm text-center py-2 px-4">{nudged}</div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {showAdd && (
          <form onSubmit={addChore} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New chore</h3>
            <input type="text" required placeholder="Chore name" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assignment</label>
                <select value={form.assignmentType} onChange={e => setForm(f => ({ ...f, assignmentType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assign to</label>
                <select value={form.assignedUserId} onChange={e => setForm(f => ({ ...f, assignedUserId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Add chore</button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {roomChores.length === 0 && !showAdd && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No active chores in this room.</p>
          </div>
        )}

        {roomChores.map(chore => (
          <div key={chore.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{chore.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {TYPE_LABELS[chore.assignmentType]} · {FREQ_LABELS[chore.frequency]} · {chore.points} pts
                  {chore.dueDate && ` · Due ${new Date(chore.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chore.status === "OVERDUE" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                {chore.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-500">{chore.assignedTo?.name ?? "Unassigned"}</span>
              <div className="flex-1" />
              <button onClick={() => completeChore(chore.id)}
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg font-medium hover:bg-green-100 transition-colors">
                Mark done
              </button>
              {chore.assignedTo && (
                <button onClick={() => nudge(chore.id)}
                  className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-lg font-medium hover:bg-yellow-100 transition-colors">
                  Nudge
                </button>
              )}
              <button onClick={() => deleteChore(chore.id)} className="text-xs text-red-400 hover:text-red-600 px-2">✕</button>
            </div>
            {chore.photos.length > 0 && (
              <div className="mt-3 flex gap-2">
                {chore.photos.map(p => (
                  <img key={p.id} src={p.url} alt="Chore photo" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
