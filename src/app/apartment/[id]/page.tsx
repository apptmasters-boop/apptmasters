"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import BottomNav from "@/components/BottomNav";

interface Member {
  id: string; role: string; status: string; joinedAt: string;
  user: { id: string; name: string; email: string; photo: string | null; roomAssignment: string | null; dietaryFlags: string };
}
interface RuleVote { id: string; vote: string; user: { id: string; name: string } }
interface HouseRule {
  id: string; content: string; version: number; status: string;
  votingEndsAt: string | null;
  votes: RuleVote[];
}
interface Apartment {
  id: string; name: string; inviteCode: string;
  announcement: string | null; announcementAt: string | null;
  members: Member[]; houseRules: HouseRule[]; currentUserRole: string;
}

export default function ApartmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [apt, setApt] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"members" | "rules" | "admin">("members");

  const [newRule, setNewRule] = useState("");
  const [addingRule, setAddingRule] = useState(false);
  const [proposeMode, setProposeMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [today, setToday] = useState<{ overdueChores: { id: string; title: string }[]; upcomingEvents: { id: string; title: string; startDate: string }[] } | null>(null);
  const [announcementEdit, setAnnouncementEdit] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [travelers, setTravelers] = useState<{ id: string; userId: string; endDate: string | null; user: { id: string; name: string } }[]>([]);
  const [travelModal, setTravelModal] = useState<string | null>(null); // userId
  const [travelForm, setTravelForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [markingTravel, setMarkingTravel] = useState(false);
  const [markingReturn, setMarkingReturn] = useState<string | null>(null);

  async function load() {
    const [aptRes, meRes, travRes] = await Promise.all([
      apiFetch(`/api/apartments/${id}`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${id}/travel`),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    if (!aptRes.ok) { router.replace("/dashboard"); return; }
    setApt(await aptRes.json());
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    if (travRes.ok) setTravelers(await travRes.json());
    setLoading(false);

    // Load today's snapshot in the background
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [choresRes, eventsRes] = await Promise.all([
      apiFetch(`/api/apartments/${id}/chores`),
      apiFetch(`/api/apartments/${id}/calendar`),
    ]);
    const chores = choresRes.ok ? await choresRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];
    setToday({
      overdueChores: chores.filter((c: { status: string; dueDate: string | null }) =>
        c.status === "PENDING" && c.dueDate && new Date(c.dueDate) < now
      ).slice(0, 3),
      upcomingEvents: events.filter((e: { startDate: string }) => {
        const d = new Date(e.startDate);
        return d >= now && d <= in7Days;
      }).slice(0, 3),
    });
  }

  useEffect(() => { load(); }, [id]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setAddingRule(true);
    await apiFetch(`/api/apartments/${id}/rules`, {
      method: "POST",
      body: JSON.stringify({ content: newRule, propose: proposeMode }),
    });
    setNewRule("");
    setAddingRule(false);
    load();
  }

  async function voteRule(ruleId: string, vote: "YES" | "NO") {
    await apiFetch(`/api/apartments/${id}/rules/${ruleId}/vote`, { method: "POST", body: JSON.stringify({ vote }) });
    load();
  }

  async function archiveRule(ruleId: string) {
    if (!confirm("Archive this rule?")) return;
    await apiFetch(`/api/apartments/${id}/rules/${ruleId}/archive`, { method: "POST" });
    load();
  }

  async function updateMember(memberId: string, update: { role?: string; status?: string }) {
    await apiFetch(`/api/apartments/${id}/members/${memberId}`, { method: "PATCH", body: JSON.stringify(update) });
    load();
  }

  async function removeMember(memberId: string, isCurrentUser = false) {
    const msg = isCurrentUser
      ? "Are you sure you want to leave this apartment? This action cannot be undone."
      : "Remove this member?";
    if (!confirm(msg)) return;
    const res = await apiFetch(`/api/apartments/${id}/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not remove member.");
      return;
    }
    if (isCurrentUser) { router.replace("/dashboard"); return; }
    load();
  }

  function copyCode() {
    navigator.clipboard.writeText(apt!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function logout() { clearToken(); router.replace("/login"); }

  async function saveAnnouncement() {
    await apiFetch(`/api/apartments/${id}`, { method: "PATCH", body: JSON.stringify({ announcement: announcementText || null }) });
    setAnnouncementEdit(false);
    load();
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/apartment/join?code=${apt!.inviteCode}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function sendInviteEmail(e: React.FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    await apiFetch(`/api/apartments/${id}/invite-email`, {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail }),
    });
    setInviteEmail("");
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
    setInviteSending(false);
  }

  async function clearAnnouncement() {
    await apiFetch(`/api/apartments/${id}`, { method: "PATCH", body: JSON.stringify({ announcement: null }) });
    load();
  }

  async function markTraveling(userId: string) {
    setMarkingTravel(true);
    await apiFetch(`/api/apartments/${id}/travel`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        startDate: travelForm.startDate || new Date().toISOString(),
        endDate: travelForm.endDate || null,
        notes: travelForm.notes || null,
      }),
    });
    setTravelModal(null);
    setTravelForm({ startDate: "", endDate: "", notes: "" });
    setMarkingTravel(false);
    load();
  }

  async function markReturned(travelId: string) {
    setMarkingReturn(travelId);
    await apiFetch(`/api/apartments/${id}/travel/${travelId}`, {
      method: "PATCH",
      body: JSON.stringify({ returned: true }),
    });
    setMarkingReturn(null);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!apt) return null;

  const isAdmin = apt.currentUserRole === "ADMIN";
  const isGuest = apt.currentUserRole === "GUEST";

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{apt.name}</span>
          {isGuest && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Guest</span>}
          {isAdmin && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/apartment/${apt.id}/search`}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Search">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
          <NotificationBell apartmentId={apt.id} />
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Announcement banner */}
        {apt.announcement && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 mb-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">📢 Announcement</p>
              <p className="text-sm text-amber-900">{apt.announcement}</p>
              {apt.announcementAt && (
                <p className="text-xs text-amber-500 mt-1">{new Date(apt.announcementAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => { setAnnouncementEdit(true); setAnnouncementText(apt.announcement ?? ""); setTab("admin"); }}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium shrink-0">Edit</button>
            )}
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Link href={`/apartment/${apt.id}/rooms`}
            className="flex items-center justify-between bg-indigo-600 text-white rounded-xl px-4 py-4 hover:bg-indigo-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Rooms & Chores</p>
              <p className="text-xs text-indigo-200 mt-0.5">Manage chores</p>
            </div>
            <span className="text-indigo-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/finance`}
            className="flex items-center justify-between bg-emerald-600 text-white rounded-xl px-4 py-4 hover:bg-emerald-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Finance & Rent</p>
              <p className="text-xs text-emerald-200 mt-0.5">Expenses & balances</p>
            </div>
            <span className="text-emerald-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/maintenance`}
            className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 hover:bg-orange-100 transition-colors">
            <div>
              <p className="font-semibold text-sm">Maintenance</p>
              <p className="text-xs text-orange-400 mt-0.5">Room issues & notes</p>
            </div>
            <span className="text-orange-300">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/chores`}
            className="flex items-center justify-between bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors">
            <div>
              <p className="font-semibold text-sm">All Chores</p>
              <p className="text-xs text-indigo-400 mt-0.5">View & filter all pending chores</p>
            </div>
            <span className="text-indigo-400">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/grocery`}
            className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-4 hover:bg-amber-600 transition-colors">
            <div>
              <p className="font-semibold text-sm">Grocery List</p>
              <p className="text-xs text-amber-100 mt-0.5">Shared shopping list</p>
            </div>
            <span className="text-amber-100">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/inventory`}
            className="flex items-center justify-between bg-teal-600 text-white rounded-xl px-4 py-4 hover:bg-teal-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Inventory</p>
              <p className="text-xs text-teal-200 mt-0.5">Supplies & items</p>
            </div>
            <span className="text-teal-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/fund`}
            className="flex items-center justify-between bg-violet-600 text-white rounded-xl px-4 py-4 hover:bg-violet-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Apartment Fund</p>
              <p className="text-xs text-violet-200 mt-0.5">Shared pool for supplies</p>
            </div>
            <span className="text-violet-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/feed`}
            className="flex items-center justify-between bg-rose-500 text-white rounded-xl px-4 py-4 hover:bg-rose-600 transition-colors">
            <div>
              <p className="font-semibold text-sm">Activity Feed</p>
              <p className="text-xs text-rose-200 mt-0.5">Events & announcements</p>
            </div>
            <span className="text-rose-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/calendar`}
            className="flex items-center justify-between bg-sky-600 text-white rounded-xl px-4 py-4 hover:bg-sky-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Calendar</p>
              <p className="text-xs text-sky-200 mt-0.5">Guests, maintenance, events</p>
            </div>
            <span className="text-sky-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/agreements`}
            className="flex items-center justify-between bg-slate-700 text-white rounded-xl px-4 py-4 hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-semibold text-sm">Shared Agreements</p>
              <p className="text-xs text-slate-300 mt-0.5">Lease, WiFi, emergency contacts</p>
            </div>
            <span className="text-slate-300">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/chat`}
            className="col-span-2 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl px-4 py-4 hover:from-indigo-700 hover:to-violet-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Chat & Calls</p>
              <p className="text-xs text-indigo-200 mt-0.5">Group chat, DMs, voice & video</p>
            </div>
            <span className="text-indigo-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/scores`}
            className="flex items-center justify-between bg-emerald-600 text-white rounded-xl px-4 py-4 hover:bg-emerald-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Roommate Scores</p>
              <p className="text-xs text-emerald-200 mt-0.5">Points, history & move-out</p>
            </div>
            <span className="text-emerald-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/disputes`}
            className="flex items-center justify-between bg-red-500 text-white rounded-xl px-4 py-4 hover:bg-red-600 transition-colors">
            <div>
              <p className="font-semibold text-sm">Disputes</p>
              <p className="text-xs text-red-200 mt-0.5">Raise & resolve conflicts</p>
            </div>
            <span className="text-red-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/rotation`}
            className="flex items-center justify-between bg-orange-500 text-white rounded-xl px-4 py-4 hover:bg-orange-600 transition-colors">
            <div>
              <p className="font-semibold text-sm">Purchase Rotation</p>
              <p className="text-xs text-orange-100 mt-0.5">Whose turn to buy supplies</p>
            </div>
            <span className="text-orange-100">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/cleaning`}
            className="flex items-center justify-between bg-cyan-600 text-white rounded-xl px-4 py-4 hover:bg-cyan-700 transition-colors">
            <div>
              <p className="font-semibold text-sm">Cleaning Rotation</p>
              <p className="text-xs text-cyan-200 mt-0.5">Who cleans next</p>
            </div>
            <span className="text-cyan-200">→</span>
          </Link>
          <Link href={`/apartment/${apt.id}/stats`}
            className="col-span-2 flex items-center justify-between bg-gray-800 text-white rounded-xl px-4 py-4 hover:bg-gray-900 transition-colors">
            <div>
              <p className="font-semibold text-sm">Stats & Analytics</p>
              <p className="text-xs text-gray-400 mt-0.5">Spending, chores, rent history</p>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* Today at a glance */}
        {today && (today.overdueChores.length > 0 || today.upcomingEvents.length > 0) && (
          <div className="bg-white border border-amber-200 rounded-xl px-5 py-4 mb-2 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Today at a glance</p>
            {today.overdueChores.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Overdue chores</p>
                <div className="space-y-1">
                  {today.overdueChores.map(c => (
                    <Link key={c.id} href={`/apartment/${apt.id}/chores?status=OVERDUE`}
                      className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {today.upcomingEvents.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Coming up (next 7 days)</p>
                <div className="space-y-1">
                  {today.upcomingEvents.map(e => (
                    <Link key={e.id} href={`/apartment/${apt.id}/calendar`}
                      className="flex items-center gap-2 text-sm text-gray-700 hover:underline">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                      {e.title} · {new Date(e.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invite code */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-indigo-400 mb-0.5">Invite code</p>
            <p className="text-2xl font-mono font-bold text-indigo-700 tracking-widest">{apt.inviteCode}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button onClick={copyCode} className="text-sm text-indigo-600 font-medium hover:underline">
              {copied ? "Copied!" : "Copy code"}
            </button>
            <button onClick={copyInviteLink} className="text-xs text-indigo-400 hover:text-indigo-600">
              {linkCopied ? "Link copied!" : "Copy invite link"}
            </button>
          </div>
        </div>

        {/* Email invite */}
        {isAdmin && (
          <form onSubmit={sendInviteEmail} className="flex gap-2 mb-4">
            <input
              type="email" placeholder="Invite by email…" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)} required
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={inviteSending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {inviteSent ? "Sent!" : inviteSending ? "Sending…" : "Send invite"}
            </button>
          </form>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {(["members", "rules", ...(isAdmin ? ["admin"] : [])] as const).map(t => (
            <button key={t} onClick={() => setTab(t as typeof tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {tab === "members" && (
          <div className="space-y-3">
            {apt.members.map(m => {
              const flags: string[] = JSON.parse(m.user.dietaryFlags || "[]");
              const activeTravelPeriod = travelers.find(t => t.userId === m.user.id);
              const canManageTravel = isAdmin || m.user.id === currentUserId;
              return (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <Link href={`/apartment/${apt.id}/members/${m.user.id}`}
                    className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors block">
                    <div className="flex items-center gap-3">
                      {m.user.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.user.photo} alt={m.user.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${activeTravelPeriod ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"}`}>
                          {activeTravelPeriod ? "✈" : m.user.name[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{m.user.name}</p>
                          {activeTravelPeriod && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              ✈ Traveling{activeTravelPeriod.endDate ? ` until ${new Date(activeTravelPeriod.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {m.user.roomAssignment ?? "No room"} · {m.role} · {m.status}
                          {flags.length > 0 && ` · ${flags.join(", ")}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-gray-300 text-sm">→</span>
                  </Link>
                  {canManageTravel && (
                    <div className="px-5 pb-3 border-t border-gray-50 flex gap-2 pt-2">
                      {activeTravelPeriod ? (
                        <button
                          onClick={() => markReturned(activeTravelPeriod.id)}
                          disabled={markingReturn === activeTravelPeriod.id}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 disabled:opacity-50 transition-colors">
                          {markingReturn === activeTravelPeriod.id ? "…" : "Mark returned"}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setTravelModal(m.user.id); setTravelForm({ startDate: "", endDate: "", notes: "" }); }}
                          className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition-colors">
                          ✈ Mark as traveling
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Travel modal */}
        {travelModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Mark as traveling</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                  <input type="date" value={travelForm.startDate}
                    onChange={e => setTravelForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Return date (optional)</label>
                  <input type="date" value={travelForm.endDate}
                    onChange={e => setTravelForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                  <input type="text" placeholder="Visiting family, work trip…" value={travelForm.notes}
                    onChange={e => setTravelForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <p className="text-xs text-gray-400">While traveling: cleaning rotation skips this person, and new expenses with equal split exclude them.</p>
              <div className="flex gap-2">
                <button onClick={() => markTraveling(travelModal!)} disabled={markingTravel}
                  className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {markingTravel ? "Saving…" : "Confirm travel"}
                </button>
                <button onClick={() => setTravelModal(null)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules tab */}
        {tab === "rules" && (
          <div className="space-y-3">
            {apt.houseRules.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No house rules yet.</p>
            )}
            {apt.houseRules.map((rule, i) => {
              const isProposed = rule.status === "PROPOSED";
              const myVote = rule.votes.find(v => v.user.id === currentUserId);
              const yesCount = rule.votes.filter(v => v.vote === "YES").length;
              const noCount = rule.votes.filter(v => v.vote === "NO").length;
              return (
                <div key={rule.id} className={`bg-white border rounded-xl px-5 py-4 ${isProposed ? "border-amber-300" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {!isProposed && <span className="text-sm font-medium text-gray-400">{i + 1}.</span>}
                        <p className="text-sm text-gray-700">{rule.content}</p>
                        {isProposed && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Proposed</span>}
                      </div>
                      {isProposed && rule.votingEndsAt && (
                        <p className="text-xs text-gray-400">Voting ends {new Date(rule.votingEndsAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    {isAdmin && !isProposed && (
                      <button onClick={() => archiveRule(rule.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">Archive</button>
                    )}
                  </div>
                  {isProposed && !isGuest && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                      <button onClick={() => voteRule(rule.id, "YES")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${myVote?.vote === "YES" ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        ✓ Yes ({yesCount})
                      </button>
                      <button onClick={() => voteRule(rule.id, "NO")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${myVote?.vote === "NO" ? "bg-red-500 text-white border-red-500" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        ✗ No ({noCount})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!isGuest && (
              <form onSubmit={addRule} className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <input
                    type="text" required placeholder={isAdmin ? "Add a house rule…" : "Propose a rule…"}
                    value={newRule} onChange={e => setNewRule(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" disabled={addingRule}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {addingRule ? "…" : isAdmin ? "Add" : "Propose"}
                  </button>
                </div>
                {isAdmin && (
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={proposeMode} onChange={e => setProposeMode(e.target.checked)} />
                    Put to a vote (48h) instead of adding directly
                  </label>
                )}
              </form>
            )}
          </div>
        )}

        {/* Admin tab */}
        {tab === "admin" && isAdmin && (
          <div className="space-y-3">
            {/* Announcement control */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">Announcement</p>
              {announcementEdit ? (
                <div className="space-y-2">
                  <textarea
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    rows={3}
                    placeholder="Type an announcement for all members…"
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveAnnouncement}
                      className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                      Save
                    </button>
                    <button onClick={() => setAnnouncementEdit(false)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-amber-700 flex-1">
                    {apt.announcement ?? <span className="text-amber-400 italic">No announcement set</span>}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setAnnouncementText(apt.announcement ?? ""); setAnnouncementEdit(true); }}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                      {apt.announcement ? "Edit" : "Add"}
                    </button>
                    {apt.announcement && (
                      <button onClick={clearAnnouncement}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">Clear</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Manage members, roles, and statuses.</p>
              <Link href={`/apartment/${id}/audit`} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
                View audit log →
              </Link>
            </div>
            {apt.members.map(m => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-gray-900">{m.user.name}</p>
                  <div className="flex items-center gap-3">
                    <Link href={`/apartment/${id}/moveout/${m.user.id}`} className="text-xs text-indigo-500 hover:underline">Report</Link>
                    <button onClick={() => removeMember(m.id, m.user.id === currentUserId)} className="text-xs text-red-400 hover:text-red-600">
                      {m.user.id === currentUserId ? "Leave" : "Remove"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["ADMIN", "MEMBER", "GUEST"] as const).map(r => (
                    <button key={r} onClick={() => updateMember(m.id, { role: r })}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${m.role === r ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {r}
                    </button>
                  ))}
                  <div className="w-px bg-gray-200 mx-1" />
                  {(["ACTIVE", "VACATION", "MOVED_OUT"] as const).map(s => (
                    <button key={s} onClick={() => updateMember(m.id, { status: s })}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${m.status === s ? "bg-amber-500 text-white border-amber-500" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav apartmentId={apt.id} />
    </div>
  );
}
