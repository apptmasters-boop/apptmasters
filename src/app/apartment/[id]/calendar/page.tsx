"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const EVENT_TYPES = ["EVENT", "MAINTENANCE", "GUEST", "RENT", "TRAVEL"] as const;
const TYPE_COLORS: Record<string, string> = {
  EVENT: "bg-blue-100 text-blue-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  GUEST: "bg-green-100 text-green-700",
  RENT: "bg-blue-100 text-blue-700",
  TRAVEL: "bg-purple-100 text-purple-700",
};
const TYPE_DOT: Record<string, string> = {
  EVENT: "bg-blue-400",
  MAINTENANCE: "bg-orange-400",
  GUEST: "bg-green-400",
  RENT: "bg-blue-400",
  TRAVEL: "bg-purple-400",
};

interface CalendarEvent {
  id: string; title: string; type: string; startDate: string; endDate: string | null;
  allDay: boolean; notes: string | null;
  user: { id: string; name: string };
}

const BLANK_FORM = { title: "", type: "EVENT", startDate: "", endDate: "", notes: "", allDay: true };

export default function CalendarPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Calendar grid state
  const now = new Date();
  const [gridYear, setGridYear] = useState(now.getFullYear());
  const [gridMonth, setGridMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
    setForm({ ...BLANK_FORM });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/calendar/${editingEvent.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: form.title,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || null,
        notes: form.notes || null,
        allDay: form.allDay,
      }),
    });
    setEditingEvent(null);
    setForm({ ...BLANK_FORM });
    setSaving(false);
    load();
  }

  function startEdit(event: CalendarEvent) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      type: event.type,
      startDate: event.startDate.slice(0, 10),
      endDate: event.endDate ? event.endDate.slice(0, 10) : "",
      notes: event.notes ?? "",
      allDay: event.allDay,
    });
    setShowForm(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/calendar/${id}`, { method: "DELETE" });
    if (editingEvent?.id === id) setEditingEvent(null);
    load();
  }

  // Build calendar grid
  function buildGrid() {
    const firstDay = new Date(gridYear, gridMonth, 1);
    const lastDay = new Date(gridYear, gridMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const days: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  function eventsOnDate(day: number) {
    const iso = `${gridYear}-${String(gridMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.startDate.slice(0, 10) <= iso && (e.endDate ? e.endDate.slice(0, 10) >= iso : e.startDate.slice(0, 10) === iso));
  }

  function isoDate(day: number) {
    return `${gridYear}-${String(gridMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const grid = buildGrid();

  const selectedEvents = selectedDate
    ? events.filter(e => e.startDate.slice(0, 10) <= selectedDate && (e.endDate ? e.endDate.slice(0, 10) >= selectedDate : e.startDate.slice(0, 10) === selectedDate))
    : [];

  const upcoming = events.filter(e => e.startDate.slice(0, 10) >= todayStr);
  const past = events.filter(e => e.startDate.slice(0, 10) < todayStr).reverse();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

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
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            <button onClick={() => setView("grid")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${view === "grid" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              Grid
            </button>
            <button onClick={() => setView("list")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${view === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              List
            </button>
          </div>
          <button onClick={() => { setShowForm(s => !s); setEditingEvent(null); }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            + Event
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Add event form */}
        {showForm && (
          <EventForm form={form} setForm={setForm} saving={saving} onSubmit={save} onCancel={() => setShowForm(false)} />
        )}
        {/* Edit form */}
        {editingEvent && (
          <EventForm form={form} setForm={setForm} saving={saving} onSubmit={saveEdit} onCancel={() => setEditingEvent(null)} editing />
        )}

        {/* Grid view */}
        {view === "grid" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <button onClick={() => {
                if (gridMonth === 0) { setGridMonth(11); setGridYear(y => y - 1); }
                else setGridMonth(m => m - 1);
              }} className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded transition-colors">‹</button>
              <p className="font-semibold text-gray-900">
                {new Date(gridYear, gridMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
              <button onClick={() => {
                if (gridMonth === 11) { setGridMonth(0); setGridYear(y => y + 1); }
                else setGridMonth(m => m + 1);
              }} className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded transition-colors">›</button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-medium text-gray-400 border-b border-gray-100">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {grid.map((day, i) => {
                if (!day) return <div key={i} className="border-b border-r border-gray-50 p-1 min-h-[52px]" />;
                const dayEvents = eventsOnDate(day);
                const iso = isoDate(day);
                const isToday = iso === todayStr;
                const isSelected = iso === selectedDate;
                return (
                  <button key={i} onClick={() => setSelectedDate(isSelected ? null : iso)}
                    className={`border-b border-r border-gray-50 p-1.5 min-h-[52px] text-left transition-colors hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}>
                    <span className={`text-xs font-medium inline-flex w-5 h-5 items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}>
                      {day}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[ev.type] ?? "bg-gray-400"}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected date events */}
            {selectedDate && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                {selectedEvents.length === 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">No events</p>
                    <button onClick={() => { setForm({ ...BLANK_FORM, startDate: selectedDate }); setShowForm(true); setSelectedDate(null); }}
                      className="text-xs text-blue-600 hover:underline">+ Add event</button>
                  </div>
                ) : selectedEvents.map(ev => (
                  <div key={ev.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[ev.type] ?? "bg-gray-400"}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                        <p className="text-xs text-gray-400">{ev.type} · {ev.user.name}</p>
                        {ev.notes && <p className="text-xs text-gray-400 italic">{ev.notes}</p>}
                      </div>
                    </div>
                    {(ev.user.id === currentUserId || isAdmin) && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEdit(ev)} className="text-xs text-blue-400 hover:text-blue-600">Edit</button>
                        <button onClick={() => deleteEvent(ev.id)} className="text-xs text-gray-300 hover:text-red-400">×</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <>
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
                    onEdit={() => startEdit(event)} onDelete={() => deleteEvent(event.id)} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Past</p>
                {past.map(event => (
                  <EventCard key={event.id} event={event} currentUserId={currentUserId} isAdmin={isAdmin}
                    onEdit={() => startEdit(event)} onDelete={() => deleteEvent(event.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-1">
          {EVENT_TYPES.map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${TYPE_DOT[t]}`} />
              <span className="text-xs text-gray-500">{t.charAt(0) + t.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function EventForm({ form, setForm, saving, onSubmit, onCancel, editing = false }: {
  form: { title: string; type: string; startDate: string; endDate: string; notes: string; allDay: boolean };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  saving: boolean; onSubmit: (e: React.FormEvent) => void; onCancel: () => void; editing?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-gray-900">{editing ? "Edit event" : "New event"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Title</label>
          <input required type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start date</label>
          <input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End date (optional)</label>
          <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : editing ? "Update" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

function EventCard({ event, currentUserId, isAdmin, onEdit, onDelete }: {
  event: CalendarEvent; currentUserId: string; isAdmin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const canAct = event.user.id === currentUserId || isAdmin;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-medium text-gray-900">{event.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[event.type] ?? "bg-gray-100 text-gray-600"}`}>
            {event.type}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {new Date(event.startDate + "T12:00:00").toLocaleDateString()}
          {event.endDate && ` – ${new Date(event.endDate + "T12:00:00").toLocaleDateString()}`}
          {" · "}{event.user.name}
        </p>
        {event.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{event.notes}</p>}
      </div>
      {canAct && (
        <div className="flex gap-3 shrink-0">
          <button onClick={onEdit} className="text-xs text-blue-400 hover:text-blue-600 transition-colors">Edit</button>
          <button onClick={onDelete} className="text-xs text-gray-300 hover:text-red-400 transition-colors">×</button>
        </div>
      )}
    </div>
  );
}
