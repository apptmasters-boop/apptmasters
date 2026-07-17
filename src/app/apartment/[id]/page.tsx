"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface Member {
  id: string; role: string; status: string; joinedAt: string; expiresAt: string | null;
  user: { id: string; name: string; email: string; photo: string | null; roomAssignment: string | null; dietaryFlags: string };
}
interface JoinRequest {
  id: string; user: { id: string; name: string; email: string; photo: string | null };
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
  const [actions, setActions] = useState<{
    totalOwed: number;
    cashToConfirm: { expenseId: string; expenseTitle: string; userName: string; amount: number }[];
    editApprovalCount: number;
    cleaningDue: boolean;
  } | null>(null);
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
  const [activeSection, setActiveSection] = useState<"chores" | "money" | "household" | "community" | "people">("chores");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  async function load() {
    const [aptRes, meRes, travRes] = await Promise.all([
      apiFetch(`/api/apartments/${id}`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${id}/travel`),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    if (!aptRes.ok) { router.replace("/dashboard"); return; }
    setApt(await aptRes.json());
    let myUserId = "";
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); myUserId = me.id; setIsSuperAdmin(me.systemRole === "SUPER_ADMIN"); }
    if (travRes.ok) setTravelers(await travRes.json());
    setLoading(false);

    // Load all background data in parallel
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [choresRes, eventsRes, balRes, expRes, erRes, cleanRes] = await Promise.all([
      apiFetch(`/api/apartments/${id}/chores`),
      apiFetch(`/api/apartments/${id}/calendar`),
      apiFetch(`/api/apartments/${id}/balance`),
      apiFetch(`/api/apartments/${id}/expenses`),
      apiFetch(`/api/apartments/${id}/edit-requests`),
      apiFetch(`/api/apartments/${id}/cleaning`),
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

    // Compute personal action items
    const balData = balRes.ok ? await balRes.json() : null;
    const totalOwed: number = balData?.myBalance
      ?.filter((b: { direction: string }) => b.direction === "you_owe")
      .reduce((s: number, b: { amount: number }) => s + b.amount, 0) ?? 0;

    const expenses = expRes.ok ? await expRes.json() : [];
    const cashToConfirm: { expenseId: string; expenseTitle: string; userName: string; amount: number }[] = [];
    for (const exp of expenses) {
      if (exp.paidBy?.id !== myUserId) continue;
      for (const split of exp.splits ?? []) {
        if (split.status === "PENDING_CASH" && split.userId !== myUserId) {
          cashToConfirm.push({ expenseId: exp.id, expenseTitle: exp.title, userName: split.user?.name ?? "Someone", amount: split.amount });
        }
      }
    }

    const editRequests = erRes.ok ? await erRes.json() : [];
    const editApprovalCount: number = editRequests.filter((req: { requesterId: string; approvals: { approver: { id: string } }[] }) =>
      req.requesterId !== myUserId && !req.approvals.some(a => a.approver.id === myUserId)
    ).length;

    const cleaningRotations = cleanRes.ok ? await cleanRes.json() : [];
    const cleaningDue: boolean = cleaningRotations.some((r: { currentUserId: string }) => r.currentUserId === myUserId);

    setActions({ totalOwed, cashToConfirm, editApprovalCount, cleaningDue });

    // Load join requests (only visible to admins; returns 403 for others — handle gracefully)
    const jrRes = await apiFetch(`/api/apartments/${id}/join-requests`);
    if (jrRes.ok) setJoinRequests(await jrRes.json());
    else setJoinRequests([]);
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

  async function updateMember(memberId: string, update: { role?: string; status?: string; expiresAt?: string | null }) {
    await apiFetch(`/api/apartments/${id}/members/${memberId}`, { method: "PATCH", body: JSON.stringify(update) });
    load();
  }

  async function setGuestExpiry(memberId: string, dateStr: string | null) {
    await apiFetch(`/api/apartments/${id}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ expiresAt: dateStr ? new Date(dateStr + "T23:59:59").toISOString() : null }),
    });
    load();
  }

  async function approveJoin(memberId: string) {
    await apiFetch(`/api/apartments/${id}/join-requests/${memberId}/approve`, { method: "POST" });
    load();
  }

  async function rejectJoin(memberId: string) {
    if (!confirm("Reject this join request?")) return;
    await apiFetch(`/api/apartments/${id}/join-requests/${memberId}/reject`, { method: "POST" });
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

        {/* Action items */}
        {actions && (actions.totalOwed > 0.01 || actions.cashToConfirm.length > 0 || actions.editApprovalCount > 0 || actions.cleaningDue) && (() => {
          const count = (actions.totalOwed > 0.01 ? 1 : 0) + actions.cashToConfirm.length + (actions.editApprovalCount > 0 ? 1 : 0) + (actions.cleaningDue ? 1 : 0);
          return (
            <div className="mb-4 bg-white border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-red-50">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Action needed</p>
                <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">{count}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {actions.totalOwed > 0.01 && (
                  <Link href={`/apartment/${apt.id}/finance`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-lg">💰</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">You owe <span className="text-red-600">${actions.totalOwed.toFixed(2)}</span></p>
                      <p className="text-xs text-gray-400">Tap to settle in Finance</p>
                    </div>
                    <span className="text-gray-300">→</span>
                  </Link>
                )}
                {actions.cashToConfirm.map((c, i) => (
                  <Link key={i} href={`/apartment/${apt.id}/finance`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-lg">💵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.userName} paid <span className="text-amber-600">${c.amount.toFixed(2)}</span> in cash</p>
                      <p className="text-xs text-gray-400 truncate">For: {c.expenseTitle} · Confirm or deny</p>
                    </div>
                    <span className="text-gray-300">→</span>
                  </Link>
                ))}
                {actions.editApprovalCount > 0 && (
                  <Link href={`/apartment/${apt.id}/finance`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-lg">✏️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{actions.editApprovalCount} expense edit {actions.editApprovalCount === 1 ? "request" : "requests"} to review</p>
                      <p className="text-xs text-gray-400">Tap to approve in Finance → Approvals</p>
                    </div>
                    <span className="text-gray-300">→</span>
                  </Link>
                )}
                {actions.cleaningDue && (
                  <Link href={`/apartment/${apt.id}/cleaning`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-lg">🧹</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">It&apos;s your turn to clean</p>
                      <p className="text-xs text-gray-400">Check the cleaning rotation</p>
                    </div>
                    <span className="text-gray-300">→</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })()}

        {/* Today at a glance — always visible */}
        {today && (today.overdueChores.length > 0 || today.upcomingEvents.length > 0) && (
          <div className="bg-white border border-amber-200 rounded-xl px-5 py-4 mb-4 space-y-3">
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

        {/* Section cards — switches with bottom nav */}
        <div className="mb-24">
          {activeSection === "chores" && (
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/apartment/${apt.id}/chores`}
                className="col-span-2 flex items-center justify-between bg-indigo-600 text-white rounded-2xl px-5 py-5 hover:bg-indigo-700 transition-colors">
                <div>
                  <p className="font-bold text-base">Chores</p>
                  <p className="text-xs text-indigo-200 mt-0.5">View & manage all chores</p>
                </div>
                <span className="text-indigo-300 text-xl">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/cleaning`}
                className="flex items-center justify-between bg-cyan-600 text-white rounded-2xl px-4 py-5 hover:bg-cyan-700 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Cleaning Rotation</p>
                  <p className="text-xs text-cyan-200 mt-0.5">Who cleans next</p>
                </div>
                <span className="text-cyan-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/rotation`}
                className="flex items-center justify-between bg-orange-500 text-white rounded-2xl px-4 py-5 hover:bg-orange-600 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Purchase Rotation</p>
                  <p className="text-xs text-orange-100 mt-0.5">Whose turn to buy</p>
                </div>
                <span className="text-orange-200">→</span>
              </Link>
            </div>
          )}

          {activeSection === "money" && (
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/apartment/${apt.id}/finance`}
                className="col-span-2 flex items-center justify-between bg-emerald-600 text-white rounded-2xl px-5 py-5 hover:bg-emerald-700 transition-colors">
                <div>
                  <p className="font-bold text-base">Finance & Rent</p>
                  <p className="text-xs text-emerald-200 mt-0.5">Expenses & balances</p>
                </div>
                <span className="text-emerald-300 text-xl">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/fund`}
                className="flex items-center justify-between bg-violet-600 text-white rounded-2xl px-4 py-5 hover:bg-violet-700 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Apartment Fund</p>
                  <p className="text-xs text-violet-200 mt-0.5">Shared pool</p>
                </div>
                <span className="text-violet-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/disputes`}
                className="flex items-center justify-between bg-red-500 text-white rounded-2xl px-4 py-5 hover:bg-red-600 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Disputes</p>
                  <p className="text-xs text-red-200 mt-0.5">Raise & resolve conflicts</p>
                </div>
                <span className="text-red-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/stats`}
                className="col-span-2 flex items-center justify-between bg-gray-100 border border-gray-200 text-gray-700 rounded-2xl px-4 py-3 hover:bg-gray-200 transition-colors">
                <p className="text-sm font-medium">Stats & Analytics</p>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          )}

          {activeSection === "household" && (
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/apartment/${apt.id}/grocery`}
                className="col-span-2 flex items-center justify-between bg-amber-500 text-white rounded-2xl px-5 py-5 hover:bg-amber-600 transition-colors">
                <div>
                  <p className="font-bold text-base">Grocery List</p>
                  <p className="text-xs text-amber-100 mt-0.5">Shared shopping list</p>
                </div>
                <span className="text-amber-200 text-xl">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/maintenance`}
                className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl px-4 py-5 hover:bg-orange-100 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Maintenance</p>
                  <p className="text-xs text-orange-400 mt-0.5">Room issues & notes</p>
                </div>
                <span className="text-orange-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/inventory`}
                className="flex items-center justify-between bg-teal-600 text-white rounded-2xl px-4 py-5 hover:bg-teal-700 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Inventory</p>
                  <p className="text-xs text-teal-200 mt-0.5">Supplies & items</p>
                </div>
                <span className="text-teal-300">→</span>
              </Link>
            </div>
          )}

          {activeSection === "community" && (
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/apartment/${apt.id}/chat`}
                className="col-span-2 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl px-5 py-5 hover:from-indigo-700 hover:to-violet-700 transition-colors">
                <div>
                  <p className="font-bold text-base">Chat & Calls</p>
                  <p className="text-xs text-indigo-200 mt-0.5">Group chat, DMs, voice & video</p>
                </div>
                <span className="text-indigo-300 text-xl">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/calendar`}
                className="flex items-center justify-between bg-sky-600 text-white rounded-2xl px-4 py-5 hover:bg-sky-700 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Calendar</p>
                  <p className="text-xs text-sky-200 mt-0.5">Events & guests</p>
                </div>
                <span className="text-sky-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/feed`}
                className="flex items-center justify-between bg-rose-500 text-white rounded-2xl px-4 py-5 hover:bg-rose-600 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Activity Feed</p>
                  <p className="text-xs text-rose-200 mt-0.5">Events & announcements</p>
                </div>
                <span className="text-rose-300">→</span>
              </Link>
              <Link href={`/apartment/${apt.id}/agreements`}
                className="col-span-2 flex items-center justify-between bg-gray-100 border border-gray-200 text-gray-700 rounded-2xl px-4 py-3 hover:bg-gray-200 transition-colors">
                <p className="text-sm font-medium">Shared Agreements</p>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          )}

          {activeSection === "people" && (
            <div className="space-y-4">
              {/* Profile link */}
              <Link href="/profile"
                className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">My Profile</p>
                    <p className="text-xs text-gray-400">Settings, password, preferences</p>
                  </div>
                </div>
                <span className="text-gray-300">→</span>
              </Link>

              {/* Invite code */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex items-center justify-between">
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
                <form onSubmit={sendInviteEmail} className="flex gap-2">
                  <input
                    type="email" placeholder="Invite by email…" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)} required
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" disabled={inviteSending}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {inviteSent ? "Sent!" : inviteSending ? "…" : "Invite"}
                  </button>
                </form>
              )}

              {/* Members / Rules / Admin tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(["members", "rules", ...(isAdmin ? ["admin"] : [])] as const).map(t => (
                  <button key={t} onClick={() => setTab(t as typeof tab)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Members */}
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
                              <button onClick={() => markReturned(activeTravelPeriod.id)} disabled={markingReturn === activeTravelPeriod.id}
                                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 disabled:opacity-50 transition-colors">
                                {markingReturn === activeTravelPeriod.id ? "…" : "Mark returned"}
                              </button>
                            ) : (
                              <button onClick={() => { setTravelModal(m.user.id); setTravelForm({ startDate: "", endDate: "", notes: "" }); }}
                                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition-colors">
                                ✈ Mark as traveling
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <Link href={`/apartment/${apt.id}/scores`}
                    className="flex items-center justify-between bg-gray-100 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 hover:bg-gray-200 transition-colors">
                    <p className="text-sm font-medium">Roommate Scores</p>
                    <span className="text-gray-400">→</span>
                  </Link>
                </div>
              )}

              {/* Rules */}
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
                        <input type="text" required placeholder={isAdmin ? "Add a house rule…" : "Propose a rule…"}
                          value={newRule} onChange={e => setNewRule(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

              {/* Admin */}
              {tab === "admin" && isAdmin && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">Announcement</p>
                    {announcementEdit ? (
                      <div className="space-y-2">
                        <textarea value={announcementText} onChange={e => setAnnouncementText(e.target.value)} rows={3}
                          placeholder="Type an announcement for all members…"
                          className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        <div className="flex gap-2">
                          <button onClick={saveAnnouncement} className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">Save</button>
                          <button onClick={() => setAnnouncementEdit(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-amber-700 flex-1">
                          {apt.announcement ?? <span className="text-amber-400 italic">No announcement set</span>}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => { setAnnouncementText(apt.announcement ?? ""); setAnnouncementEdit(true); }}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium">{apt.announcement ? "Edit" : "Add"}</button>
                          {apt.announcement && (
                            <button onClick={clearAnnouncement} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Manage members, roles, and statuses.</p>
                    <Link href={`/apartment/${id}/audit`} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">View audit log →</Link>
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
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${m.role === r ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>{r}</button>
                        ))}
                        <div className="w-px bg-gray-200 mx-1" />
                        {(["ACTIVE", "VACATION", "MOVED_OUT"] as const).map(s => (
                          <button key={s} onClick={() => updateMember(m.id, { status: s })}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${m.status === s ? "bg-amber-500 text-white border-amber-500" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                            {s.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                      {/* Guest expiry — only for GUEST members */}
                      {m.role === "GUEST" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">Access until:</span>
                          <input
                            type="date"
                            defaultValue={m.expiresAt ? m.expiresAt.split("T")[0] : ""}
                            onChange={e => setGuestExpiry(m.id, e.target.value || null)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          {m.expiresAt && (
                            <span className="text-xs text-amber-600 font-medium">
                              {new Date(m.expiresAt) < new Date() ? "Expired" : "Active"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pending join requests — visible to ADMIN role members only */}
                  {joinRequests.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Pending Requests ({joinRequests.length})
                      </p>
                      <div className="space-y-2">
                        {joinRequests.map(jr => (
                          <div key={jr.id} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-sm font-semibold text-amber-800 flex-shrink-0">
                              {jr.user.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{jr.user.name}</p>
                              <p className="text-xs text-gray-400 truncate">{jr.user.email}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => approveJoin(jr.id)}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                                Approve
                              </button>
                              <button
                                onClick={() => rejectJoin(jr.id)}
                                className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 transition-colors">
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Travel modal */}
        {travelModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Mark as traveling</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                  <input type="date" value={travelForm.startDate} onChange={e => setTravelForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Return date (optional)</label>
                  <input type="date" value={travelForm.endDate} onChange={e => setTravelForm(f => ({ ...f, endDate: e.target.value }))}
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
      </main>

      {/* Fixed 5-tab bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex items-stretch h-16">
          {([
            {
              key: "chores" as const, label: "Chores", activeColor: "text-indigo-600",
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
            },
            {
              key: "money" as const, label: "Money", activeColor: "text-emerald-600",
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            },
            {
              key: "household" as const, label: "Household", activeColor: "text-amber-500",
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            },
            {
              key: "community" as const, label: "Chat", activeColor: "text-violet-600",
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
            },
            {
              key: "people" as const, label: "Profile", activeColor: "text-indigo-600",
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveSection(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeSection === tab.key ? tab.activeColor : "text-gray-400 hover:text-gray-600"
              }`}>
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
          {isSuperAdmin && (
            <Link href="/admin"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-purple-500 hover:text-purple-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[10px] font-medium">Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
