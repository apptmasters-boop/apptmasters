"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface GroceryItem {
  id: string; name: string; quantity: string; purchased: boolean; purchasedAt: string | null;
  addedBy: { id: string; name: string };
}

export default function GroceryPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  async function load() {
    const [itemsRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/grocery`),
      apiFetch("/api/auth/me"),
    ]);
    if (itemsRes.status === 401) { router.replace("/login"); return; }
    setItems(await itemsRes.json());
    if (meRes.ok) { const me = await meRes.json(); setCurrentUserId(me.id); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    await apiFetch(`/api/apartments/${apartmentId}/grocery`, {
      method: "POST",
      body: JSON.stringify({ name: newName, quantity: newQty }),
    });
    setNewName("");
    setNewQty("1");
    setAdding(false);
    load();
  }

  async function togglePurchased(item: GroceryItem) {
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ purchased: !item.purchased }),
    });
    load();
  }

  async function deleteItem(id: string) {
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${id}`, { method: "DELETE" });
    load();
  }

  async function clearPurchased() {
    const purchased = items.filter(i => i.purchased);
    await Promise.all(purchased.map(i => apiFetch(`/api/apartments/${apartmentId}/grocery/${i.id}`, { method: "DELETE" })));
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const pending = items.filter(i => !i.purchased);
  const purchased = items.filter(i => i.purchased);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Grocery List</span>
        </div>
        <NotificationBell apartmentId={apartmentId} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Add item form */}
        <form onSubmit={addItem} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Add to list</p>
          <div className="flex gap-2">
            <input
              type="text" required placeholder="Item name…" value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="text" placeholder="Qty" value={newQty}
              onChange={e => setNewQty(e.target.value)}
              className="w-16 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button type="submit" disabled={adding}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {adding ? "…" : "Add"}
            </button>
          </div>
        </form>

        {/* Pending items */}
        {pending.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              To get ({pending.length})
            </p>
            <div className="divide-y divide-gray-50">
              {pending.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <button onClick={() => togglePurchased(item)}
                    className="w-5 h-5 rounded border-2 border-gray-300 hover:border-amber-500 flex-shrink-0 transition-colors" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">Qty: {item.quantity} · Added by {item.addedBy.name}</p>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pending.length === 0 && purchased.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">Your grocery list is empty.</p>
            <p className="text-sm text-gray-400 mt-1">Add items above to get started.</p>
          </div>
        )}

        {/* Purchased items */}
        {purchased.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchased ({purchased.length})</p>
              <button onClick={clearPurchased} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
            </div>
            <div className="divide-y divide-gray-50">
              {purchased.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
                  <button onClick={() => togglePurchased(item)}
                    className="w-5 h-5 rounded bg-amber-500 border-2 border-amber-500 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <p className="flex-1 text-sm text-gray-500 line-through">{item.name}</p>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
