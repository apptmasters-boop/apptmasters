"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface Member { id: string; name: string; dietaryFlags: string }
interface GroceryItem {
  id: string; name: string; quantity: string; purchased: boolean; purchasedAt: string | null;
  addedBy: { id: string; name: string };
}
interface ConvertModal { item: GroceryItem; category: string; unit: string; reorderThreshold: string; expiryDate: string }

const DIETARY_LABELS: Record<string, string> = {
  VEGAN: "🌱 Vegan", VEGETARIAN: "🥦 Vegetarian", GLUTEN_FREE: "🌾 Gluten-free",
  DAIRY_FREE: "🥛 Dairy-free", NUT_FREE: "🥜 Nut-free", HALAL: "☪️ Halal", KOSHER: "✡️ Kosher",
};

export default function GroceryPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [adding, setAdding] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [convertModal, setConvertModal] = useState<ConvertModal | null>(null);
  const [converting, setConverting] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);

  // Aggregate dietary restrictions across all members
  const allFlags = Array.from(new Set(
    members.flatMap(m => { try { return JSON.parse(m.dietaryFlags); } catch { return []; } })
  ));

  async function load() {
    const [itemsRes, aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/grocery`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (itemsRes.status === 401) { router.replace("/login"); return; }
    setItems(await itemsRes.json());
    if (aptRes.ok) {
      const apt = await aptRes.json();
      setMembers(apt.members.map((m: { user: Member }) => m.user));
    }
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
    setNewName(""); setNewQty("1");
    setAdding(false);
    load();
  }

  async function togglePurchased(item: GroceryItem) {
    if (!item.purchased) {
      // Open convert modal instead of direct toggle
      setConvertModal({ item, category: "SUPPLIES", unit: "units", reorderThreshold: "1", expiryDate: "" });
      return;
    }
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${item.id}`, {
      method: "PATCH", body: JSON.stringify({ purchased: false }),
    });
    load();
  }

  async function markPurchasedOnly(item: GroceryItem) {
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${item.id}`, {
      method: "PATCH", body: JSON.stringify({ purchased: true }),
    });
    setConvertModal(null);
    load();
  }

  async function convertToInventory() {
    if (!convertModal) return;
    setConverting(true);
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${convertModal.item.id}/convert`, {
      method: "POST",
      body: JSON.stringify({
        category: convertModal.category,
        unit: convertModal.unit,
        reorderThreshold: parseFloat(convertModal.reorderThreshold),
        expiryDate: convertModal.expiryDate || null,
      }),
    });
    setConverting(false);
    setConvertModal(null);
    load();
  }

  async function deleteItem(id: string) {
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${id}`, { method: "DELETE" });
    load();
  }

  async function clearPurchased() {
    const purchased = items.filter(i => i.purchased);
    await Promise.all(purchased.map(i =>
      apiFetch(`/api/apartments/${apartmentId}/grocery/${i.id}`, { method: "DELETE" })
    ));
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
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <button onClick={() => setShoppingMode(true)}
              className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition-colors">
              Shop
            </button>
          )}
          <NotificationBell apartmentId={apartmentId} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Dietary flags banner */}
        {allFlags.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1.5">Household dietary needs</p>
            <div className="flex flex-wrap gap-1.5">
              {allFlags.map((flag: string) => (
                <span key={flag} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  {DIETARY_LABELS[flag] ?? flag}
                </span>
              ))}
            </div>
          </div>
        )}

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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">In cart / purchased ({purchased.length})</p>
              <button onClick={clearPurchased} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
            </div>
            <div className="divide-y divide-gray-50">
              {purchased.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3 opacity-60">
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

      {/* Shopping mode overlay */}
      {shoppingMode && (
        <div className="fixed inset-0 bg-white z-40 flex flex-col">
          <div className="bg-amber-500 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">Shopping mode</p>
              <p className="text-amber-100 text-xs">{pending.filter(i => !i.purchased).length} items left</p>
            </div>
            <button onClick={() => setShoppingMode(false)}
              className="text-white text-sm font-medium bg-amber-600 px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
              Done
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {pending.map(item => (
              <button key={item.id} onClick={() => togglePurchased(item)}
                className={`w-full flex items-center gap-4 px-5 py-5 text-left transition-colors ${item.purchased ? "bg-green-50" : "bg-white hover:bg-gray-50"}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${item.purchased ? "bg-amber-500 border-amber-500" : "border-gray-300"}`}>
                  {item.purchased && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-lg font-medium ${item.purchased ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {item.name}
                  </p>
                  <p className="text-sm text-gray-400">Qty: {item.quantity}</p>
                </div>
              </button>
            ))}
            {purchased.map(item => (
              <button key={item.id} onClick={() => togglePurchased(item)}
                className="w-full flex items-center gap-4 px-5 py-5 text-left bg-green-50 transition-colors hover:bg-green-100">
                <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-amber-500 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-400 line-through">{item.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Convert-to-inventory modal */}
      {convertModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">"{convertModal.item.name}" purchased!</h3>
              <p className="text-sm text-gray-500 mt-1">Add it to inventory or just mark as bought?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={convertModal.category}
                  onChange={e => setConvertModal(m => m ? { ...m, category: e.target.value } : m)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {["SUPPLIES", "FOOD", "APPLIANCE", "OTHER"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                <input type="text" value={convertModal.unit}
                  onChange={e => setConvertModal(m => m ? { ...m, unit: e.target.value } : m)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reorder below</label>
                <input type="number" min="0" value={convertModal.reorderThreshold}
                  onChange={e => setConvertModal(m => m ? { ...m, reorderThreshold: e.target.value } : m)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry date</label>
                <input type="date" value={convertModal.expiryDate}
                  onChange={e => setConvertModal(m => m ? { ...m, expiryDate: e.target.value } : m)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={convertToInventory} disabled={converting}
                className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {converting ? "Adding…" : "Add to inventory"}
              </button>
              <button onClick={() => markPurchasedOnly(convertModal.item)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                Just mark bought
              </button>
            </div>
            <button onClick={() => setConvertModal(null)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
