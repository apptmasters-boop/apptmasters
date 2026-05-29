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

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  USER: "bg-gray-100 text-gray-600",
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "apartments">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    const [uRes, aRes] = await Promise.all([
      apiFetch("/api/admin/users"),
      apiFetch("/api/admin/apartments"),
    ]);
    if (uRes.status === 403) { router.replace("/dashboard"); return; }
    if (uRes.ok) setUsers(await uRes.json());
    if (aRes.ok) setApartments(await aRes.json());
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Super Admin Panel</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Company</span>
        </div>
        <button onClick={() => { clearToken(); router.replace("/login"); }}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {(["users", "apartments"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t} {t === "users" ? `(${users.length})` : `(${apartments.length})`}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Apartments</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
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
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {u.systemRole === "USER" && (
                          <button onClick={() => setRole(u.id, "MANAGER")} disabled={working === u.id}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                            Make Manager
                          </button>
                        )}
                        {u.systemRole === "MANAGER" && (
                          <>
                            <button onClick={() => setRole(u.id, "USER")} disabled={working === u.id}
                              className="text-xs text-gray-500 hover:underline disabled:opacity-50">
                              Demote
                            </button>
                            <button onClick={() => setRole(u.id, "SUPER_ADMIN")} disabled={working === u.id}
                              className="text-xs text-purple-600 hover:underline disabled:opacity-50">
                              Make Super Admin
                            </button>
                          </>
                        )}
                        {u.systemRole === "SUPER_ADMIN" && (
                          <button onClick={() => setRole(u.id, "MANAGER")} disabled={working === u.id}
                            className="text-xs text-gray-500 hover:underline disabled:opacity-50">
                            Demote to Manager
                          </button>
                        )}
                        <button onClick={() => deleteUser(u.id, u.name)} disabled={working === u.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
