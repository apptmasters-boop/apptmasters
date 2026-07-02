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
    </div>
  );
}
