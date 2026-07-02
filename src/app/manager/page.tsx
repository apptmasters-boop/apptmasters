"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface Building {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  _count: { units: number };
}

export default function ManagerPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  async function load() {
    const res = await apiFetch("/api/manager/buildings");
    if (res.status === 403) { router.replace("/dashboard"); return; }
    if (res.ok) setBuildings(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setCreating(true);
    const res = await apiFetch("/api/manager/buildings", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), address: address.trim() }),
    });
    if (res.ok) {
      setName("");
      setAddress("");
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
          <span className="font-bold text-gray-900">Landlord Portal</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Manager</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">Tenant view →</Link>
          <button onClick={() => { clearToken(); router.replace("/login"); }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Your buildings ({buildings.length})</h2>
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + Add building
          </button>
        </div>

        {showForm && (
          <form onSubmit={createBuilding} className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
            <div className="flex gap-3">
              <input
                type="text" placeholder="Building name…" value={name} required
                onChange={e => setName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="text" placeholder="Street address…" value={address} required
                onChange={e => setAddress(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" disabled={creating}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creating ? "Adding…" : "Add"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </form>
        )}

        {buildings.length === 0 && !showForm && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🏢</p>
            <p className="text-gray-500 font-medium">No buildings yet</p>
            <p className="text-sm text-gray-400 mt-1">Add your first building to start managing units and tenants.</p>
          </div>
        )}

        {buildings.map(b => (
          <Link key={b.id} href={`/manager/buildings/${b.id}`}
            className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{b.address}</p>
                <p className="text-xs text-gray-400 mt-1">{b._count.units} unit{b._count.units !== 1 ? "s" : ""}</p>
              </div>
              <span className="text-gray-400 text-lg">→</span>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
