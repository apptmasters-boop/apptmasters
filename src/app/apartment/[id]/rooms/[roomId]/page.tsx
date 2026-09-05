"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface Member { id: string; name: string }
interface SwapRequest { id: string; fromUser: { id: string; name: string }; toUser: { id: string; name: string }; status: string }
interface Chore {
  id: string; title: string; status: string; assignmentType: string; frequency: string;
  dueDate: string | null; points: number; roomId: string | null;
  assignedTo: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  photos: { id: string; url: string; takenAt: string }[];
  swapRequests: SwapRequest[];
}

const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly" };
const TYPE_LABELS: Record<string, string> = { ROTATING: "Rotating", FIXED: "Fixed", VOLUNTARY: "Voluntary" };

export default function RoomDetailPage() {
  const { id: apartmentId, roomId } = useParams<{ id: string; roomId: string }>();
  const router = useRouter();
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nudged, setNudged] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null); // choreId being swapped
  const [swapToUserId, setSwapToUserId] = useState("");
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
    setChores(allChores.filter(c => c.status !== "DONE" && c.roomId === roomId));
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { user: Member }) => m.user));
    setCurrentUserId(apt.currentUserId ?? "");
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

  async function requestSwap(choreId: string) {
    if (!swapToUserId) return;
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/swap`, {
      method: "POST",
      body: JSON.stringify({ toUserId: swapToUserId }),
    });
    setSwapTarget(null);
    setSwapToUserId("");
    load();
  }

  async function respondSwap(choreId: string, swapId: string, accept: boolean) {
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/swap`, {
      method: "POST",
      body: JSON.stringify({ swapId, accept }),
    });
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}/rooms`} className="text-sm text-gray-400 hover:text-gray-600">← Rooms</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{roomName}</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowAdd(s => !s)} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            + Add chore
          </button>
        </div>
      </header>

      {nudged && (
        <div className="bg-blue-600 text-white text-sm text-center py-2 px-4">{nudged}</div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {showAdd && (
          <form onSubmit={addChore} className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New chore</h3>
            <input type="text" required placeholder="Chore name" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assignment</label>
                <select value={form.assignmentType} onChange={e => setForm(f => ({ ...f, assignmentType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assign to</label>
                <select value={form.assignedUserId} onChange={e => setForm(f => ({ ...f, assignedUserId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Points (1–10)</label>
                <input type="number" min={1} max={10} value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Add chore</button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {chores.length === 0 && !showAdd && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No active chores in this room.</p>
          </div>
        )}

        {chores.map(chore => {
          const isMyChore = chore.assignedTo?.id === currentUserId;
          const incomingSwap = chore.swapRequests.find(s => s.toUser.id === currentUserId && s.status === "PENDING");
          const outgoingSwap = chore.swapRequests.find(s => s.fromUser.id === currentUserId && s.status === "PENDING");

          return (
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

              <p className="text-xs text-gray-500 mb-3">{chore.assignedTo?.name ?? "Unassigned"}</p>

              {/* Incoming swap request */}
              {incomingSwap && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
                  <p className="text-xs text-amber-700 font-medium">
                    {incomingSwap.fromUser.name} wants you to take this chore
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => respondSwap(chore.id, incomingSwap.id, true)}
                      className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-green-700 transition-colors">
                      Accept
                    </button>
                    <button onClick={() => respondSwap(chore.id, incomingSwap.id, false)}
                      className="text-xs bg-white text-red-600 border border-red-200 px-2.5 py-1 rounded-md font-medium hover:bg-red-50 transition-colors">
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Outgoing pending swap */}
              {outgoingSwap && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs text-blue-700">Swap requested → {outgoingSwap.toUser.name} (pending)</p>
                </div>
              )}

              {/* Swap request form */}
              {swapTarget === chore.id && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 mb-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Request swap with:</p>
                  <select value={swapToUserId} onChange={e => setSwapToUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Pick a roommate…</option>
                    {members.filter(m => m.id !== currentUserId).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => requestSwap(chore.id)} disabled={!swapToUserId}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                      Send request
                    </button>
                    <button onClick={() => { setSwapTarget(null); setSwapToUserId(""); }}
                      className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
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
                {isMyChore && !outgoingSwap && !incomingSwap && swapTarget !== chore.id && (
                  <button onClick={() => { setSwapTarget(chore.id); setSwapToUserId(""); }}
                    className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg font-medium hover:bg-purple-100 transition-colors">
                    Swap
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
          );
        })}
      </main>
    </div>
  );
}
