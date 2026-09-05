"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import PushNotificationButton from "@/components/PushNotificationButton";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  ANNOUNCEMENT: "📢",
  CALENDAR_EVENT: "📅",
  CHORE_ASSIGNED: "🧹",
  CHORE_OVERDUE: "⚠️",
  CHORE_SWAP_REQUEST: "🔄",
  CHORE_SWAP_ACCEPTED: "✅",
  CHORE_SWAP_DECLINED: "❌",
  EXPENSE_ADDED: "💸",
  EXPENSE_SETTLED: "💚",
  FUND_CONTRIBUTION: "💰",
  FUND_WITHDRAWAL: "💸",
  FUND_LOW: "⚠️",
  GROCERY_ADDED: "🛒",
  ITEM_BORROWED: "📦",
  ITEM_RETURNED: "🔄",
  NUDGE: "👋",
  DISPUTE_FILED: "⚖️",
  DISPUTE_RESOLVED: "🤝",
  DISPUTE_DISMISSED: "🗑️",
  MAINTENANCE_FLAGGED: "🛠️",
  MAINTENANCE_RESOLVED: "✅",
  MAINTENANCE_NOTE_UPDATED: "📝",
  ROOM_CLEAN: "🧼",
  ROOM_DIRTY: "🧽",
  ROOM_NEEDS_ATTENTION: "⚠️",
  ROTATION_CREATED: "🆕",
  SCORE_ADJUSTED: "📈",
  DISPUTE_COMMENT: "💬",
  RULE_ADDED: "📋",
  RULE_PROPOSED: "📋",
  RULE_PASSED: "📌",
  ROTATION_PURCHASED: "🛍️",
  SYSTEM: "🔔",
};

export default function NotificationsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    const res = await apiFetch(`/api/apartments/${apartmentId}/notifications`);
    if (res.status === 401) { router.replace("/login"); return; }
    if (res.ok) setNotifications(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function markRead(id: string) {
    await apiFetch(`/api/apartments/${apartmentId}/notifications/${id}/read`, { method: "POST" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      await markRead(notification.id);
    }

    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    await apiFetch(`/api/apartments/${apartmentId}/notifications/read-all`, { method: "POST" });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={markingAll}
            className="text-sm text-blue-600 font-medium hover:underline disabled:opacity-50">
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="flex justify-end">
          <PushNotificationButton />
        </div>

        {notifications.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-400">No notifications yet.</p>
            <p className="text-sm text-gray-400 mt-1">You'll see chore reminders, swap requests, and more here.</p>
          </div>
        )}

        {notifications.map(n => (
          <button key={n.id} onClick={() => handleNotificationClick(n)}
            className={`w-full text-left bg-white border rounded-xl px-5 py-4 flex items-start gap-4 transition-colors ${n.read ? "border-gray-100 opacity-60" : "border-gray-200 hover:border-blue-200"}`}>
            <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.read ? "text-gray-500" : "text-gray-900 font-semibold"}`}>{n.title}</p>
              <p className={`text-sm mt-1 ${n.read ? "text-gray-500" : "text-gray-700"}`}>{n.body}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {n.link ? (
                <p className="text-xs text-blue-600 font-medium mt-2">Open linked item →</p>
              ) : null}
            </div>
            {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
          </button>
        ))}
      </main>
    </div>
  );
}
