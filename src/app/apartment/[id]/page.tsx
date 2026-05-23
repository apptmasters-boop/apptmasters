"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

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

  async function load() {
    const [aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${id}`),
      apiFetch("/api/auth/me"),
    ]);
    if (aptRes.status === 401) { router.replace("/login"); return; }
    if (!aptRes.ok) { router.replace("/dashboard"); return; }
    setApt(await aptRes.json());
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
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

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member?")) return;
    await apiFetch(`/api/apartments/${id}/members/${memberId}`, { method: "DELETE" });
    load();
  }

  function copyCode() {
    navigator.clipboard.writeText(apt!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function logout() { clearToken(); router.replace("/login"); }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!apt) return null;

  const isAdmin = apt.currentUserRole === "ADMIN";
  const isGuest = apt.currentUserRole === "GUEST";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{apt.name}</span>
          {isGuest && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Guest</span>}
          {isAdmin && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apt.id} />
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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
            className="col-span-2 flex items-center justify-between bg-slate-700 text-white rounded-xl px-4 py-4 hover:bg-slate-800 transition-colors">
            <div>
              <p className="font-semibold text-sm">Shared Agreements</p>
              <p className="text-xs text-slate-300 mt-0.5">Lease, WiFi, emergency contacts</p>
            </div>
            <span className="text-slate-300">→</span>
          </Link>
        </div>

        {/* Invite code */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-indigo-400 mb-0.5">Invite code</p>
            <p className="text-2xl font-mono font-bold text-indigo-700 tracking-widest">{apt.inviteCode}</p>
          </div>
          <button onClick={copyCode} className="text-sm text-indigo-600 font-medium hover:underline">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

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
              return (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-600">
                      {m.user.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{m.user.name}</p>
                      <p className="text-xs text-gray-400">
                        {m.user.roomAssignment ?? "No room"} · {m.role} · {m.status}
                        {flags.length > 0 && ` · ${flags.join(", ")}`}
                      </p>
                    </div>
                  </div>
                  {m.status === "VACATION" && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">On vacation</span>
                  )}
                </div>
              );
            })}
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
            <p className="text-sm text-gray-500 mb-4">Manage members, roles, and statuses.</p>
            {apt.members.map(m => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-gray-900">{m.user.name}</p>
                  <button onClick={() => removeMember(m.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
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
    </div>
  );
}
