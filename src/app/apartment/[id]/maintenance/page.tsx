"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Room {
  id: string; name: string; type: string;
  maintenanceFlag: boolean; maintenanceNotes: string | null;
  escalatedAt: string | null; updatedAt: string;
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

  // Escalation state
  const [escalatingRoom, setEscalatingRoom] = useState<Room | null>(null);
  const [landlordEmail, setLandlordEmail] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // roomId

  async function load() {
    const [aptRes, roomsRes, agreementsRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch(`/api/apartments/${apartmentId}/rooms`),
      apiFetch(`/api/apartments/${apartmentId}/agreements`),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    const apt = await aptRes.json();
    setIsAdmin(apt.currentUserRole === "ADMIN");
    if (roomsRes.ok) setRooms(await roomsRes.json());
    // Pre-fill landlord email from shared agreements if available
    if (agreementsRes.ok) {
      const agreements: { key: string; value: string }[] = await agreementsRes.json();
      const stored = agreements.find(a => a.key === "LANDLORD_EMAIL");
      if (stored) setLandlordEmail(stored.value);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  function openEscalate(room: Room) {
    setEscalatingRoom(room);
    setSent(null);
    const defaultBody = [
      `Dear Landlord,`,
      ``,
      `I am writing to report a maintenance issue in the ${room.name} at our apartment.`,
      ``,
      room.maintenanceNotes
        ? `Issue description:\n${room.maintenanceNotes}`
        : `Please contact us for more details about the issue.`,
      ``,
      `This issue was first reported on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} and requires your attention.`,
      ``,
      `Please let us know when you can address this.`,
      ``,
      `Thank you,`,
      `The residents`,
    ].join("\n");
    setEmailBody(defaultBody);
  }

  async function sendEscalation() {
    if (!escalatingRoom || !landlordEmail.trim()) return;
    setSending(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/rooms/${escalatingRoom.id}/escalate`, {
      method: "POST",
      body: JSON.stringify({ landlordEmail: landlordEmail.trim(), emailBody }),
    });
    setSending(false);
    if (res.ok) {
      setSent(escalatingRoom.id);
      setEscalatingRoom(null);
      load();
    }
  }

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
            <Link href={`/apartment/${apartmentId}/rooms`} className="text-sm text-indigo-600 hover:underline mt-1 block">Go to rooms →</Link>
          </div>
        )}

        {flagged.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Needs attention ({flagged.length})</h2>
            {flagged.map(room => (
              <RoomCard key={room.id} room={room} isAdmin={isAdmin}
                editingNotes={editingNotes} notesText={notesText} saving={saving}
                justSent={sent === room.id}
                onToggle={() => toggleMaintenance(room)}
                onEditNotes={() => { setEditingNotes(room.id); setNotesText(room.maintenanceNotes ?? ""); }}
                onNotesChange={setNotesText}
                onSaveNotes={() => saveNotes(room.id)}
                onCancelNotes={() => setEditingNotes(null)}
                onEscalate={() => openEscalate(room)}
              />
            ))}
          </section>
        )}

        {clear.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">All clear ({clear.length})</h2>
            {clear.map(room => (
              <RoomCard key={room.id} room={room} isAdmin={isAdmin}
                editingNotes={editingNotes} notesText={notesText} saving={saving}
                justSent={false}
                onToggle={() => toggleMaintenance(room)}
                onEditNotes={() => { setEditingNotes(room.id); setNotesText(room.maintenanceNotes ?? ""); }}
                onNotesChange={setNotesText}
                onSaveNotes={() => saveNotes(room.id)}
                onCancelNotes={() => setEditingNotes(null)}
                onEscalate={() => openEscalate(room)}
              />
            ))}
          </section>
        )}
      </main>

      {/* Escalation modal */}
      {escalatingRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-gray-900">Escalate to landlord</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Send an email to your landlord about the <strong>{escalatingRoom.name}</strong> issue.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Landlord email *</label>
              <input type="email" required placeholder="landlord@example.com" value={landlordEmail}
                onChange={e => setLandlordEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <p className="text-xs text-gray-400 mt-1">
                Tip: save it in <Link href={`/apartment/${apartmentId}/agreements`} className="text-indigo-500 hover:underline">Shared Agreements</Link> as "Landlord Email" for next time.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Email message (editable)</label>
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={10}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none font-mono" />
            </div>

            <div className="flex gap-2">
              <button onClick={sendEscalation} disabled={sending || !landlordEmail.trim()}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {sending ? "Sending…" : "Send to landlord"}
              </button>
              <button onClick={() => setEscalatingRoom(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, isAdmin, editingNotes, notesText, saving, justSent, onToggle, onEditNotes, onNotesChange, onSaveNotes, onCancelNotes, onEscalate }: {
  room: Room; isAdmin: boolean;
  editingNotes: string | null; notesText: string; saving: boolean; justSent: boolean;
  onToggle: () => void; onEditNotes: () => void;
  onNotesChange: (v: string) => void; onSaveNotes: () => void; onCancelNotes: () => void;
  onEscalate: () => void;
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

      {isEditing ? (
        <div className="space-y-2">
          <textarea value={notesText} onChange={e => onNotesChange(e.target.value)} rows={3}
            placeholder="Describe the maintenance issue…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
          <button onClick={onEditNotes} className="text-xs text-indigo-500 hover:underline flex-shrink-0">
            {room.maintenanceNotes ? "Edit" : "Add notes"}
          </button>
        </div>
      )}

      {/* Escalation section */}
      {room.maintenanceFlag && (
        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
          {room.escalatedAt ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-600 font-medium">
                Escalated {new Date(room.escalatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button onClick={onEscalate}
                className="text-xs text-gray-400 hover:text-orange-600 transition-colors">
                Re-send
              </button>
            </div>
          ) : justSent ? (
            <span className="text-xs text-green-600 font-medium">Email sent to landlord ✓</span>
          ) : (
            <button onClick={onEscalate}
              className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">
              📧 Escalate to landlord
            </button>
          )}
        </div>
      )}
    </div>
  );
}
