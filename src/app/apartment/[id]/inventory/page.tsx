"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const CATEGORIES = ["SUPPLIES", "FOOD", "APPLIANCE", "OTHER"] as const;
const CONDITIONS = ["GOOD", "FAIR", "POOR"] as const;

interface Borrower { id: string; name: string }
interface ActiveBorrow { id: string; borrower: Borrower; borrowedAt: string }
interface InventoryItem {
  id: string; name: string; category: string; quantity: number; unit: string;
  reorderThreshold: number; expiryDate: string | null; isShared: boolean;
  condition: string; notes: string | null; updatedAt: string;
  borrows: ActiveBorrow[];
}
interface RotationMember { id: string; name: string }
interface Rotation {
  id: string; itemName: string; frequency: string;
  currentUserId: string; currentUserName: string;
  memberOrder: RotationMember[]; lastBought: string | null;
}

const categoryColors: Record<string, string> = {
  SUPPLIES: "bg-blue-100 text-blue-700",
  FOOD: "bg-green-100 text-green-700",
  APPLIANCE: "bg-purple-100 text-purple-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default function InventoryPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    name: "", category: "SUPPLIES", quantity: "1", unit: "units",
    reorderThreshold: "1", expiryDate: "", condition: "GOOD", notes: "", isShared: true,
  });
  const [saving, setSaving] = useState(false);
  const [borrowing, setBorrowing] = useState<string | null>(null);
  const [showRotationForm, setShowRotationForm] = useState(false);
  const [rotForm, setRotForm] = useState({ itemName: "", frequency: "MONTHLY", memberIds: [] as string[] });
  const [members, setMembers] = useState<RotationMember[]>([]);

  async function load() {
    const [itemsRes, meRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/inventory`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (itemsRes.status === 401) { router.replace("/login"); return; }
    setItems(await itemsRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUserId(me.id);
      if (aptRes.ok) {
        const apt = await aptRes.json();
        const mem: RotationMember[] = apt.members.map((m: { user: RotationMember }) => m.user);
        setMembers(mem);
        const myMembership = apt.members.find((m: { user: { id: string }; role: string }) => m.user.id === me.id);
        setIsAdmin(myMembership?.role === "ADMIN");
      }
    }
    const rotRes = await apiFetch(`/api/apartments/${apartmentId}/rotation`);
    if (rotRes.ok) setRotations(await rotRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  function openAdd() {
    setEditItem(null);
    setForm({ name: "", category: "SUPPLIES", quantity: "1", unit: "units", reorderThreshold: "1", expiryDate: "", condition: "GOOD", notes: "", isShared: true });
    setShowForm(true);
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setForm({
      name: item.name, category: item.category, quantity: String(item.quantity),
      unit: item.unit, reorderThreshold: String(item.reorderThreshold),
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
      condition: item.condition, notes: item.notes ?? "", isShared: item.isShared,
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name, category: form.category, quantity: parseFloat(form.quantity),
      unit: form.unit, reorderThreshold: parseFloat(form.reorderThreshold),
      expiryDate: form.expiryDate || null, condition: form.condition,
      notes: form.notes || null, isShared: form.isShared,
    };
    if (editItem) {
      await apiFetch(`/api/apartments/${apartmentId}/inventory/${editItem.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await apiFetch(`/api/apartments/${apartmentId}/inventory`, { method: "POST", body: JSON.stringify(payload) });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/inventory/${id}`, { method: "DELETE" });
    load();
  }

  async function adjustQty(item: InventoryItem, delta: number) {
    const qty = Math.max(0, item.quantity + delta);
    await apiFetch(`/api/apartments/${apartmentId}/inventory/${item.id}`, {
      method: "PATCH", body: JSON.stringify({ quantity: qty }),
    });
    load();
  }

  async function borrowItem(itemId: string) {
    setBorrowing(itemId);
    await apiFetch(`/api/apartments/${apartmentId}/inventory/${itemId}/borrow`, { method: "POST" });
    setBorrowing(null);
    load();
  }

  async function returnItem(itemId: string) {
    setBorrowing(itemId);
    await apiFetch(`/api/apartments/${apartmentId}/inventory/${itemId}/return`, { method: "POST" });
    setBorrowing(null);
    load();
  }

  async function markRotationBought(rotationId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/rotation/${rotationId}`, { method: "POST" });
    load();
  }

  async function deleteRotation(rotationId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/rotation/${rotationId}`, { method: "DELETE" });
    load();
  }

  async function createRotation(e: React.FormEvent) {
    e.preventDefault();
    if (rotForm.memberIds.length < 2) { alert("Select at least 2 members"); return; }
    await apiFetch(`/api/apartments/${apartmentId}/rotation`, {
      method: "POST",
      body: JSON.stringify(rotForm),
    });
    setShowRotationForm(false);
    setRotForm({ itemName: "", frequency: "MONTHLY", memberIds: [] });
    load();
  }

  function toggleRotMember(id: string) {
    setRotForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter(x => x !== id) : [...f.memberIds, id],
    }));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const filtered = filter === "ALL" ? items : filter === "LOW"
    ? items.filter(i => i.quantity <= i.reorderThreshold)
    : items.filter(i => i.category === filter);

  const lowCount = items.filter(i => i.quantity <= i.reorderThreshold).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Inventory</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={openAdd} className="text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-teal-700 transition-colors">
            + Add item
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Add/Edit form */}
        {showForm && (
          <form onSubmit={save} className="bg-white border border-teal-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">{editItem ? "Edit item" : "New inventory item"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Condition</label>
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                <input type="number" min="0" step="0.1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reorder when below</label>
                <input type="number" min="0" step="0.1" value={form.reorderThreshold} onChange={e => setForm(f => ({ ...f, reorderThreshold: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry date</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="isShared" checked={form.isShared} onChange={e => setForm(f => ({ ...f, isShared: e.target.checked }))}
                  className="rounded border-gray-300 text-teal-600" />
                <label htmlFor="isShared" className="text-sm text-gray-700">Shared item (roommates can borrow)</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["ALL", "LOW", ...CATEGORIES].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-teal-600 text-white border-teal-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {f === "LOW" ? `⚠ Low (${lowCount})` : f === "ALL" ? `All (${items.length})` : f}
            </button>
          ))}
        </div>

        {/* Items */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">{filter === "LOW" ? "No low-stock items." : "No items yet."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const isLow = item.quantity <= item.reorderThreshold;
              const myBorrow = item.borrows.find(b => b.borrower.id === currentUserId);
              const otherBorrows = item.borrows.filter(b => b.borrower.id !== currentUserId);
              return (
                <div key={item.id} className={`bg-white border rounded-xl px-5 py-4 ${isLow ? "border-orange-300" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category]}`}>{item.category}</span>
                        {isLow && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">LOW</span>}
                        {item.isShared && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">Shared</span>}
                      </div>
                      {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                      {item.expiryDate && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Expires {new Date(item.expiryDate).toLocaleDateString()}
                        </p>
                      )}
                      {/* Borrow status */}
                      {item.borrows.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.borrows.map(b => (
                            <span key={b.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.borrower.id === currentUserId ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                              {b.borrower.id === currentUserId ? "You have this" : `${b.borrower.name} borrowed`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty(item, -1)}
                        className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors">−</button>
                      <span className="w-14 text-center text-sm font-semibold text-gray-900">
                        {item.quantity} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                      </span>
                      <button onClick={() => adjustQty(item, 1)}
                        className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-colors">+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 flex-wrap gap-2">
                    <p className="text-xs text-gray-400">Reorder below {item.reorderThreshold} · {item.condition}</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      {/* Borrow / Return for shared items */}
                      {item.isShared && (
                        myBorrow ? (
                          <button onClick={() => returnItem(item.id)} disabled={borrowing === item.id}
                            className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {borrowing === item.id ? "…" : "Return"}
                          </button>
                        ) : (
                          <button onClick={() => borrowItem(item.id)} disabled={borrowing === item.id}
                            className="text-xs bg-teal-50 text-teal-700 hover:bg-teal-100 px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {borrowing === item.id ? "…" : "Borrow"}
                          </button>
                        )
                      )}
                      <button onClick={() => openEdit(item)} className="text-xs text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Purchase Rotations */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchase rotations</p>
            {isAdmin && (
              <button onClick={() => setShowRotationForm(v => !v)}
                className="text-xs text-teal-600 hover:underline font-medium">
                {showRotationForm ? "Cancel" : "+ New rotation"}
              </button>
            )}
          </div>

          {/* New rotation form */}
          {showRotationForm && (
            <form onSubmit={createRotation} className="px-5 py-4 border-b border-gray-100 space-y-3 bg-teal-50">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 mb-1 block">Item to track</label>
                  <input required type="text" placeholder="e.g. Dish soap, Toilet paper" value={rotForm.itemName}
                    onChange={e => setRotForm(f => ({ ...f, itemName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Frequency</label>
                  <select value={rotForm.frequency} onChange={e => setRotForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {["WEEKLY", "BIWEEKLY", "MONTHLY"].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Members (rotation order)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <button key={m.id} type="button" onClick={() => toggleRotMember(m.id)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${rotForm.memberIds.includes(m.id) ? "bg-teal-600 text-white border-teal-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                Create rotation
              </button>
            </form>
          )}

          {rotations.length === 0 && !showRotationForm ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">
              No rotations yet.{isAdmin ? " Add one to track who buys shared items." : ""}
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {rotations.map(rot => {
                const isMyTurn = rot.currentUserId === currentUserId;
                return (
                  <div key={rot.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{rot.itemName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {rot.frequency.charAt(0) + rot.frequency.slice(1).toLowerCase()} ·{" "}
                        {rot.memberOrder.map(m => m.name).join(" → ")}
                      </p>
                      {rot.lastBought && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last bought {new Date(rot.lastBought).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isMyTurn ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                        {isMyTurn ? "Your turn" : `${rot.currentUserName}'s turn`}
                      </span>
                      {isMyTurn && (
                        <button onClick={() => markRotationBought(rot.id)}
                          className="text-xs bg-teal-600 text-white px-3 py-1 rounded-lg hover:bg-teal-700 font-medium transition-colors">
                          Mark bought
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteRotation(rot.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
