"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const EVENT_TYPES = ["EVENT", "MAINTENANCE", "GUEST", "RENT", "TRAVEL"] as const;
const TYPE_COLORS: Record<string, string> = {
  EVENT: "bg-indigo-100 text-indigo-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  GUEST: "bg-green-100 text-green-700",
  RENT: "bg-blue-100 text-blue-700",
  TRAVEL: "bg-purple-100 text-purple-700",
};

interface CalendarEvent {
  id: string; title: string; type: string; startDate: string; endDate: string | null;
  allDay: boolean; notes: string | null;
  user: { id: string; name: string };
}

export default function CalendarPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "EVENT", startDate: "", endDate: "", notes: "", allDay: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [eventsRes, aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/calendar`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (eventsRes.status === 401) { router.replace("/login"); return; }
    setEvents(await eventsRes.json());
    if (aptRes.ok) { const apt = await aptRes.json(); setIsAdmin(apt.currentUserRole === "ADMIN"); }
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/calendar`, {
      method: "POST",
      body: JSON.stringify({ ...form, endDate: form.endDate || null }),
    });
    setForm({ title: "", type: "EVENT", startDate: "", endDate: "", notes: "", allDay: true });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/calendar/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events.filter(e => new Date(e.startDate) >= today);
  const past = events.filter(e => new Date(e.startDate) < today);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Calendar</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + Event
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Add event form */}
        {showForm && (
          <form onSubmit={save} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New event</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Title</label>
                <input required type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                <input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End date (optional)</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No events yet.</p>
            <p className="text-sm text-gray-400 mt-1">Add guests, maintenance, rent due dates, and more.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Upcoming</p>
            {upcoming.map(event => (
              <EventCard key={event.id} event={event} currentUserId={currentUserId} isAdmin={isAdmin}
                onDelete={() => deleteEvent(event.id)} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Past</p>
            {past.map(event => (
              <EventCard key={event.id} event={event} currentUserId={currentUserId} isAdmin={isAdmin}
                onDelete={() => deleteEvent(event.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({ event, currentUserId, isAdmin, onDelete }: {
  event: CalendarEvent; currentUserId: string; isAdmin: boolean; onDelete: () => void;
}) {
  const typeColors: Record<string, string> = {
    EVENT: "bg-indigo-100 text-indigo-700",
    MAINTENANCE: "bg-orange-100 text-orange-700",
    GUEST: "bg-green-100 text-green-700",
    RENT: "bg-blue-100 text-blue-700",
    TRAVEL: "bg-purple-100 text-purple-700",
  };
  const canDelete = event.user.id === currentUserId || isAdmin;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-medium text-gray-900">{event.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColors[event.type] ?? "bg-gray-100 text-gray-600"}`}>
            {event.type}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {new Date(event.startDate).toLocaleDateString()}
          {event.endDate && ` – ${new Date(event.endDate).toLocaleDateString()}`}
          {" · "}{event.user.name}
        </p>
        {event.notes && <p className="text-xs text-gray-400 mt-0.5">{event.notes}</p>}
      </div>
      {canDelete && (
        <button onClick={onDelete} className="text-xs text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">×</button>
      )}
    </div>
  );
}
