"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface User {
  id: string; name: string; email: string; systemRole: string; createdAt: string;
  _count: { memberships: number };
}
interface Apartment {
  id: string; name: string; createdAt: string;
  manager: { id: string; name: string; email: string } | null;
  _count: { members: number };
}
interface AuditLog {
  id: string; action: string; meta: string; createdAt: string;
  user: { name: string } | null;
  apartment: { name: string } | null;
}
interface Stats {
  totalUsers: number; totalApartments: number; totalMessages: number; totalExpenses: number;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  USER: "bg-gray-100 text-gray-600",
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"stats" | "users" | "apartments" | "audit">("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [myApartmentId, setMyApartmentId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Apartment | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpExpiry, setOtpExpiry] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    const [uRes, aRes, auRes, sRes, meRes] = await Promise.all([
      apiFetch("/api/admin/users"),
      apiFetch("/api/admin/apartments"),
      apiFetch("/api/admin/audit"),
      apiFetch("/api/admin/stats"),
      apiFetch("/api/auth/me"),
    ]);
    if (uRes.status === 403) { router.replace("/dashboard"); return; }
    if (uRes.ok) setUsers(await uRes.json());
    if (aRes.ok) setApartments(await aRes.json());
    if (auRes.ok) setAuditLogs(await auRes.json());
    if (sRes.ok) setStats(await sRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      const apt = me.memberships?.[0]?.apartment?.id ?? null;
      setMyApartmentId(apt);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sendLandlordInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    const res = await apiFetch("/api/admin/landlord-invite", {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteMsg({ ok: true, text: `Invite sent to ${inviteEmail}` });
      setInviteEmail("");
    } else {
      setInviteMsg({ ok: false, text: data.error ?? "Failed to send invite" });
    }
    setInviting(false);
  }

  async function setRole(userId: string, systemRole: string) {
    setWorking(userId);
    await apiFetch(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ systemRole }) });
    setWorking(null);
    load();
  }

  async function deleteUser(userId: string, name: string) {
    if (!confirm(`Delete account for "${name}"? This cannot be undone.`)) return;
    setWorking(userId);
    await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setWorking(null);
    load();
  }

  async function requestDelete(apt: Apartment) {
    setDeleteTarget(apt);
    setOtpSent(false);
    setOtpInput("");
    setDeleteError("");
    const res = await apiFetch(`/api/admin/apartments/${apt.id}/request-delete`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setOtpSent(true);
      setOtpExpiry(d.expiresAt);
    } else {
      setDeleteError("Failed to send code. Try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || otpInput.length !== 6) return;
    setDeleteLoading(true);
    setDeleteError("");
    const res = await apiFetch(`/api/admin/apartments/${deleteTarget.id}`, {
      method: "DELETE",
      body: JSON.stringify({ code: otpInput }),
    });
    if (res.ok) {
      setDeleteTarget(null);
      setOtpSent(false);
      load();
    } else {
      const d = await res.json();
      setDeleteError(d.error ?? "Delete failed. Check code and try again.");
    }
    setDeleteLoading(false);
  }

  async function exportUser(userId: string, name: string) {
    setExporting(userId);
    setExportDone(null);
    const res = await apiFetch(`/api/admin/users/${userId}/export`);
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `legal-export-${name.replace(/\s+/g, "-").toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(userId);
    }
    setExporting(null);
  }

  const filteredUsers = users.filter(u =>
    !userQuery || u.name.toLowerCase().includes(userQuery.toLowerCase()) || u.email.toLowerCase().includes(userQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900">Super Admin</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">ApptMasters</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={myApartmentId ? `/apartment/${myApartmentId}` : "/dashboard"} className="text-sm text-gray-400 hover:text-gray-600">Tenant view →</Link>
          <button onClick={() => { clearToken(); router.replace("/login"); }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {(["stats", "users", "apartments", "audit"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "stats" ? "Stats" : t === "users" ? `Users (${users.length})` : t === "apartments" ? `Apartments (${apartments.length})` : "Audit Log"}
            </button>
          ))}
        </div>

        {/* Stats Tab */}
        {tab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats?.totalUsers },
                { label: "Apartments", value: stats?.totalApartments },
                { label: "Messages", value: stats?.totalMessages },
                { label: "Expenses", value: stats?.totalExpenses },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-2xl px-6 py-6">
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{s.value ?? "…"}</p>
                </div>
              ))}
            </div>

            {/* Invite Landlord */}
            <div className="bg-white border border-gray-200 rounded-2xl px-6 py-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Invite a landlord</h3>
              <p className="text-xs text-gray-400 mb-4">Send an invite link — they'll create a Manager account directly.</p>
              <form onSubmit={sendLandlordInvite} className="flex gap-3">
                <input
                  type="email" placeholder="landlord@email.com" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)} required
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                />
                <button type="submit" disabled={inviting}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </form>
              {inviteMsg && (
                <p className={`text-sm mt-3 ${inviteMsg.ok ? "text-green-600" : "text-red-600"}`}>{inviteMsg.text}</p>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="space-y-4">
            <input
              type="text" placeholder="Search by name or email…" value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Apts</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.systemRole] ?? "bg-gray-100 text-gray-600"}`}>
                          {u.systemRole}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{u._count.memberships}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => exportUser(u.id, u.name)} disabled={exporting === u.id}
                            title="Download full data export for law enforcement"
                            className={`text-xs font-medium disabled:opacity-50 ${exportDone === u.id ? "text-green-600" : "text-indigo-500 hover:text-indigo-700"}`}>
                            {exporting === u.id ? "Exporting…" : exportDone === u.id ? "Exported ✓" : "Export"}
                          </button>
                          {u.systemRole === "USER" && (
                            <button onClick={() => setRole(u.id, "MANAGER")} disabled={working === u.id}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                              Make Manager
                            </button>
                          )}
                          {u.systemRole === "MANAGER" && (
                            <>
                              <button onClick={() => setRole(u.id, "USER")} disabled={working === u.id}
                                className="text-xs text-gray-500 hover:underline disabled:opacity-50">Demote</button>
                              <button onClick={() => setRole(u.id, "SUPER_ADMIN")} disabled={working === u.id}
                                className="text-xs text-purple-600 hover:underline disabled:opacity-50">Make Super Admin</button>
                            </>
                          )}
                          {u.systemRole === "SUPER_ADMIN" && (
                            <button onClick={() => setRole(u.id, "MANAGER")} disabled={working === u.id}
                              className="text-xs text-gray-500 hover:underline disabled:opacity-50">Demote</button>
                          )}
                          <button onClick={() => deleteUser(u.id, u.name)} disabled={working === u.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Apartments Tab */}
        {tab === "apartments" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Apartment</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Manager</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Members</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apartments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {a.manager ? (
                        <div>
                          <p>{a.manager.name}</p>
                          <p className="text-xs text-gray-400">{a.manager.email}</p>
                        </div>
                      ) : <span className="text-gray-400 italic">None</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{a._count.members}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => requestDelete(a)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No audit entries yet.</p>
            ) : auditLogs.map(log => {
              let meta: Record<string, unknown> = {};
              try { meta = JSON.parse(log.meta || "{}"); } catch {}
              return (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{log.action.replace(/_/g, " ")}</span>
                      {log.user && <span className="text-xs text-gray-400">by {log.user.name}</span>}
                      {log.apartment && <span className="text-xs text-indigo-500">{log.apartment.name}</span>}
                    </div>
                    {Object.keys(meta).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* OTP Confirmation Modal for apartment deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Delete &ldquo;{deleteTarget.name}&rdquo;?</h2>
              <p className="text-xs text-gray-500 mt-1">
                This permanently deletes the apartment and ALL data — chores, expenses, chat, members. This cannot be undone.
              </p>
            </div>

            {!otpSent ? (
              <button
                onClick={() => requestDelete(deleteTarget)}
                className="w-full bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors">
                Send confirmation code to my email
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-green-700">
                    A 6-digit code was sent to your email. Expires at{" "}
                    <strong>{otpExpiry ? new Date(otpExpiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</strong>.
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
                <button
                  onClick={confirmDelete}
                  disabled={otpInput.length !== 6 || deleteLoading}
                  className="w-full bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors">
                  {deleteLoading ? "Deleting…" : "Permanently delete apartment"}
                </button>
              </div>
            )}

            {deleteError && !otpSent && <p className="text-xs text-red-500">{deleteError}</p>}
            <button
              onClick={() => { setDeleteTarget(null); setOtpSent(false); setOtpInput(""); setDeleteError(""); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
