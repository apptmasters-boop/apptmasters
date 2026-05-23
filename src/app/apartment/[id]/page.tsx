"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface Member {
  id: string; role: string; status: string; joinedAt: string;
  user: { id: string; name: string; email: string; photo: string | null; roomAssignment: string | null; dietaryFlags: string };
}
interface HouseRule { id: string; content: string; version: number }
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
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await apiFetch(`/api/apartments/${id}`);
    if (res.status === 401) { router.replace("/login"); return; }
    if (!res.ok) { router.replace("/dashboard"); return; }
    setApt(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setAddingRule(true);
    await apiFetch(`/api/apartments/${id}/rules`, { method: "POST", body: JSON.stringify({ content: newRule }) });
    setNewRule("");
    setAddingRule(false);
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
        <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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
          <div className="space-y-4">
            {apt.houseRules.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No house rules yet.</p>
            )}
            {apt.houseRules.map((rule, i) => (
              <div key={rule.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-700">
                <span className="font-medium text-gray-400 mr-2">{i + 1}.</span>{rule.content}
              </div>
            ))}
            {isAdmin && !isGuest && (
              <form onSubmit={addRule} className="flex gap-2 mt-4">
                <input
                  type="text" required placeholder="Add a house rule…"
                  value={newRule} onChange={e => setNewRule(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" disabled={addingRule}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {addingRule ? "…" : "Add"}
                </button>
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
