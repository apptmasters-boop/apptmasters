"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Room {
  id: string;
  name: string;
  type: string;
  maintenanceFlag: boolean;
  maintenanceNotes: string | null;
  updatedAt: string;
}

export default function MaintenancePage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [aptRes, roomsRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch(`/api/apartments/${apartmentId}/rooms`),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    const apt = await aptRes.json();
    setIsAdmin(apt.currentUserRole === "ADMIN");
    if (roomsRes.ok) setRooms(await roomsRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function toggleMaintenance(room: Room) {
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${room.id}`, {
      method: "PATCH",
      body: JSON.stringify({ maintenanceFlag: !room.maintenanceFlag }),
    });
    load();
  }

  async function saveNotes(roomId: string) {
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/rooms/${roomId}`, {
      method: "PATCH",
      body: JSON.stringify({ maintenanceNotes: notesText || null }),
    });
    setEditingNotes(null);
    setSaving(false);
    load();
  }

  const flagged = rooms.filter(r => r.maintenanceFlag);
  const clear = rooms.filter(r => !r.maintenanceFlag);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-900">Maintenance</span>
        {flagged.length > 0 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
            {flagged.length} issue{flagged.length !== 1 ? "s" : ""}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {rooms.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🔧</p>
            <p className="text-gray-500">No rooms yet.</p>
            <Link href={`/apartment/${apartmentId}/rooms`} className="text-sm text-indigo-600 hover:underline mt-1 block">
              Go to rooms →
            </Link>
          </div>
        )}

        {/* Flagged rooms */}
        {flagged.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Needs attention ({flagged.length})</h2>
            {flagged.map(room => (
              <RoomCard key={room.id} room={room} isAdmin={isAdmin}
                editingNotes={editingNotes} notesText={notesText} saving={saving}
                onToggle={() => toggleMaintenance(room)}
                onEditNotes={() => { setEditingNotes(room.id); setNotesText(room.maintenanceNotes ?? ""); }}
                onNotesChange={setNotesText}
                onSaveNotes={() => saveNotes(room.id)}
                onCancelNotes={() => setEditingNotes(null)}
              />
            ))}
          </section>
        )}

        {/* All clear rooms */}
        {clear.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">All clear ({clear.length})</h2>
            {clear.map(room => (
              <RoomCard key={room.id} room={room} isAdmin={isAdmin}
                editingNotes={editingNotes} notesText={notesText} saving={saving}
                onToggle={() => toggleMaintenance(room)}
                onEditNotes={() => { setEditingNotes(room.id); setNotesText(room.maintenanceNotes ?? ""); }}
                onNotesChange={setNotesText}
                onSaveNotes={() => saveNotes(room.id)}
                onCancelNotes={() => setEditingNotes(null)}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function RoomCard({ room, isAdmin, editingNotes, notesText, saving, onToggle, onEditNotes, onNotesChange, onSaveNotes, onCancelNotes }: {
  room: Room; isAdmin: boolean;
  editingNotes: string | null; notesText: string; saving: boolean;
  onToggle: () => void; onEditNotes: () => void;
  onNotesChange: (v: string) => void; onSaveNotes: () => void; onCancelNotes: () => void;
}) {
  const isEditing = editingNotes === room.id;

  return (
    <div className={`bg-white border rounded-xl px-5 py-4 space-y-3 ${room.maintenanceFlag ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{room.maintenanceFlag ? "🔴" : "🟢"}</span>
          <div>
            <p className="font-medium text-gray-900">{room.name}</p>
            <p className="text-xs text-gray-400 capitalize">{room.type.toLowerCase()}</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={onToggle}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              room.maintenanceFlag
                ? "border-green-300 text-green-700 hover:bg-green-50"
                : "border-red-300 text-red-600 hover:bg-red-50"
            }`}>
            {room.maintenanceFlag ? "Mark resolved" : "Flag issue"}
          </button>
        )}
      </div>

      {/* Notes */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea value={notesText} onChange={e => onNotesChange(e.target.value)} rows={3}
            placeholder="Describe the maintenance issue…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={onSaveNotes} disabled={saving}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save notes"}
            </button>
            <button onClick={onCancelNotes} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          {room.maintenanceNotes ? (
            <p className="text-sm text-gray-600 whitespace-pre-wrap flex-1">{room.maintenanceNotes}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes</p>
          )}
          {isAdmin && (
            <button onClick={onEditNotes} className="text-xs text-indigo-500 hover:underline flex-shrink-0">
              {room.maintenanceNotes ? "Edit" : "Add notes"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
