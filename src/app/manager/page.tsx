"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface Apartment {
  id: string; name: string; inviteCode: string; createdAt: string;
  _count: { members: number };
}

export default function ManagerPage() {
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const res = await apiFetch("/api/manager/apartments");
    if (res.status === 403) { router.replace("/dashboard"); return; }
    if (res.ok) setApartments(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createApartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await apiFetch("/api/manager/apartments", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      setShowForm(false);
      load();
    }
    setCreating(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Manager Panel</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Manager</span>
        </div>
        <button onClick={() => { clearToken(); router.replace("/login"); }}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Your properties ({apartments.length})</h2>
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + New apartment
          </button>
        </div>

        {showForm && (
          <form onSubmit={createApartment} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex gap-3">
            <input
              type="text" placeholder="Apartment name…" value={newName} required
              onChange={e => setNewName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={creating}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </form>
        )}

        {apartments.length === 0 && !showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🏠</p>
            <p className="text-gray-500 font-medium">No properties yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first apartment to start managing tenants.</p>
          </div>
        )}

        {apartments.map(apt => (
          <Link key={apt.id} href={`/manager/apartments/${apt.id}`}
            className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{apt.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {apt._count.members} member{apt._count.members !== 1 ? "s" : ""} · Invite code: <span className="font-mono font-medium text-gray-600">{apt.inviteCode}</span>
                </p>
              </div>
              <span className="text-gray-400 text-lg">→</span>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
