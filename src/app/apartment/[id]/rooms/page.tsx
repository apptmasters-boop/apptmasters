"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const ROOM_TYPES = ["KITCHEN", "LIVING_ROOM", "BATHROOM", "HALLWAY", "LAUNDRY", "BALCONY", "BEDROOM", "CUSTOM"] as const;
const STATUS_COLORS: Record<string, string> = {
  CLEAN: "bg-green-100 text-green-700",
  NEEDS_ATTENTION: "bg-yellow-100 text-yellow-700",
  DIRTY: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  CLEAN: "Clean", NEEDS_ATTENTION: "Needs attention", DIRTY: "Dirty",
};

interface Chore { id: string; title: string; status: string; dueDate: string | null; assignedTo: { name: string } | null }
interface Room {
  id: string; name: string; type: string; cleanlinessStatus: string;
  maintenanceFlag: boolean; maintenanceNotes: string | null; chores: Chore[];
}

export default function RoomsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "CUSTOM" as typeof ROOM_TYPES[number] });
  const [adding, setAdding] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  async function load() {
    const [roomsRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/rooms`),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (roomsRes.status === 401) { router.replace("/login"); return; }
    setRooms(await roomsRes.json());
    if (aptRes.ok) { const apt = await aptRes.json(); setIsAdmin(apt.currentUserRole === "ADMIN"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    await apiFetch(`/api/apartments/${apartmentId}/rooms`, { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", type: "CUSTOM" });
    setShowAdd(false);
    setAdding(false);
    load();
  }

  async function updateStatus(roomId: string, cleanlinessStatus: string) {
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${roomId}`, {
      method: "PATCH", body: JSON.stringify({ cleanlinessStatus }),
    });
    load();
  }

  async function toggleMaintenance(room: Room) {
    const turning = !room.maintenanceFlag;
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${room.id}`, {
      method: "PATCH",
      body: JSON.stringify({ maintenanceFlag: turning, ...(turning ? {} : { maintenanceNotes: null }) }),
    });
    if (turning) {
      setEditingNotes(room.id);
      setNotesText(room.maintenanceNotes ?? "");
    } else {
      setEditingNotes(null);
    }
    load();
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Delete this room and all its chores?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${roomId}`, { method: "DELETE" });
    load();
  }

  async function saveNotes(roomId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${roomId}`, {
      method: "PATCH", body: JSON.stringify({ maintenanceNotes: notesText }),
    });
    setEditingNotes(null);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Rooms & Chores</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowAdd(s => !s)} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            + Add room
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {showAdd && (
          <form onSubmit={addRoom} className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New room</h3>
            <div className="flex gap-3">
              <input type="text" required placeholder="Room name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof ROOM_TYPES[number] }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROOM_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={adding} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {adding ? "Adding…" : "Add room"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {rooms.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 mb-2">No rooms yet.</p>
            <p className="text-sm text-gray-400">Add a room to start tracking chores.</p>
          </div>
        )}

        {rooms.map(room => (
          <div key={room.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href={`/apartment/${apartmentId}/rooms/${room.id}`} className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                  {room.name}
                </Link>
                {room.maintenanceFlag && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Maintenance</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMaintenance(room)}
                  className="text-xs text-gray-400 hover:text-orange-500 transition-colors">
                  {room.maintenanceFlag ? "Clear flag" : "Flag"}
                </button>
                <select value={room.cleanlinessStatus} onChange={e => updateStatus(room.id, e.target.value)}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none ${STATUS_COLORS[room.cleanlinessStatus]}`}>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {isAdmin && (
                  <button onClick={() => deleteRoom(room.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors px-1">✕</button>
                )}
              </div>
            </div>

            {/* Maintenance notes */}
            {room.maintenanceFlag && (
              <div className="border-t border-red-50 bg-red-50 px-5 py-3">
                {editingNotes === room.id ? (
                  <div className="flex gap-2">
                    <input type="text" value={notesText} onChange={e => setNotesText(e.target.value)}
                      placeholder="Describe the issue…"
                      className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                    <button onClick={() => saveNotes(room.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors">Save</button>
                    <button onClick={() => setEditingNotes(null)} className="text-xs text-gray-500 px-2">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingNotes(room.id); setNotesText(room.maintenanceNotes ?? ""); }}
                    className="text-xs text-red-600 hover:underline">
                    {room.maintenanceNotes ? room.maintenanceNotes : "Add maintenance notes…"}
                  </button>
                )}
              </div>
            )}

            {room.chores.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                {room.chores.slice(0, 3).map(chore => (
                  <div key={chore.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{chore.title}</span>
                      {chore.status === "OVERDUE" && <span className="text-xs text-red-500">Overdue</span>}
                    </div>
                    <span className="text-gray-400">{chore.assignedTo?.name ?? "Unassigned"}</span>
                  </div>
                ))}
                {room.chores.length > 3 && (
                  <Link href={`/apartment/${apartmentId}/rooms/${room.id}`} className="text-xs text-blue-500 hover:underline">
                    +{room.chores.length - 3} more →
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
