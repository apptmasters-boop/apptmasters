"use client";
/**
 * Household → Shopping (docs/PRODUCT_LOGIC.md §10): whose turn it is, the trip
 * steps (Start preparing → I'm at the store → I've left the store → Finish
 * trip) and the one shared list. The page refreshes itself every few seconds
 * so everyone sees new items and the shopper's progress without reloading.
 */
import { BackLink } from "@/components/home/HomeNav";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const REFRESH_MS = 5000;

interface Person { id: string; name: string }
interface Member { id: string; name: string; dietaryFlags: string }
interface GroceryItem { id: string; name: string; quantity: string; purchased: boolean; addedBy: Person }
interface Trip { id: string; status: "PREPARING" | "SHOPPING" | "LEFT_STORE"; shopperId: string }
interface ShoppingState {
  shopper: Person | null; next: Person | null; trip: Trip | null;
  order: (Person & { away: boolean })[];
  lastTrip: { endedAt: string; shopperName: string; itemCount: number } | null;
}
interface ConvertModal { item: GroceryItem; category: string; unit: string; reorderThreshold: string; expiryDate: string }

const DIETARY_LABELS: Record<string, string> = {
  VEGAN: "🌱 Vegan", VEGETARIAN: "🥦 Vegetarian", GLUTEN_FREE: "🌾 Gluten-free",
  DAIRY_FREE: "🥛 Dairy-free", NUT_FREE: "🥜 Nut-free", HALAL: "☪️ Halal", KOSHER: "✡️ Kosher",
};

/** What the turn card says, for the shopper ("you") and for everyone else. */
const STEP_TEXT: Record<Trip["status"], { mine: string; theirs: (name: string) => string; action: "at_store" | "left_store" | "finish"; label: string }> = {
  PREPARING: { mine: "Getting ready to shop", theirs: n => `${n} is getting ready to shop`, action: "at_store", label: "I'm at the store" },
  SHOPPING: { mine: "You're at the store", theirs: n => `${n} is at the store`, action: "left_store", label: "I've left the store" },
  LEFT_STORE: { mine: "You've left the store", theirs: n => `${n} has left the store`, action: "finish", label: "Finish trip" },
};

export default function ShoppingPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<ShoppingState | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState({ id: "", isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [convertModal, setConvertModal] = useState<ConvertModal | null>(null);
  const [orderDraft, setOrderDraft] = useState<Person[] | null>(null);

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/shopping`),
      apiFetch(`/api/apartments/${apartmentId}/grocery`),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]).then(async ([shopRes, itemsRes, aptRes]) => {
      if (!isCurrent()) return;
      if (shopRes.status === 401) { router.replace("/login"); return; }
      if (shopRes.status === 403) { router.replace("/dashboard"); return; }
      const [shop, list, apt] = await Promise.all([
        shopRes.ok ? shopRes.json() : null, itemsRes.ok ? itemsRes.json() : null, aptRes.ok ? aptRes.json() : null,
      ]);
      if (!isCurrent()) return;
      if (shop) setState(shop);
      if (list) setItems(list);
      if (apt) {
        setMembers(apt.members.map((m: { user: Member }) => m.user));
        setMe({ id: apt.currentUserId, isAdmin: apt.currentUserRole === "ADMIN" });
      }
      setLoading(false);
    }).catch(() => { if (isCurrent()) setLoading(false); }), [apartmentId, router]);

  // First load, then keep the list and the shopper's progress fresh while the page is visible.
  useEffect(() => {
    let current = true;
    load(() => current);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(() => current); }, REFRESH_MS);
    return () => { current = false; clearInterval(timer); };
  }, [load]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;

  const trip = state?.trip ?? null;
  const shopper = state?.shopper ?? null;
  const isShopper = !!shopper && shopper.id === me.id;
  const pending = items.filter(i => !i.purchased);
  const inCart = items.filter(i => i.purchased);
  const allFlags = Array.from(new Set(members.flatMap(m => { try { return JSON.parse(m.dietaryFlags) as string[]; } catch { return []; } })));

  async function tripAction(action: string) {
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/shopping/trip`, { method: "POST", body: JSON.stringify({ action }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
    setBusy(false); setConfirmFinish(false);
    load();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    await apiFetch(`/api/apartments/${apartmentId}/grocery`, { method: "POST", body: JSON.stringify({ name: newName.trim(), quantity: newQty }) });
    setNewName(""); setNewQty("1"); setBusy(false);
    load();
  }

  async function setPurchased(item: GroceryItem, purchased: boolean) {
    setItems(list => list.map(i => (i.id === item.id ? { ...i, purchased } : i))); // feels instant on a phone in the store
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${item.id}`, { method: "PATCH", body: JSON.stringify({ purchased }) });
    load();
  }

  async function deleteItem(id: string) {
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${id}`, { method: "DELETE" });
    load();
  }

  async function convertToInventory() {
    if (!convertModal) return;
    setBusy(true);
    await apiFetch(`/api/apartments/${apartmentId}/grocery/${convertModal.item.id}/convert`, {
      method: "POST",
      body: JSON.stringify({
        category: convertModal.category, unit: convertModal.unit,
        reorderThreshold: parseFloat(convertModal.reorderThreshold), expiryDate: convertModal.expiryDate || null,
      }),
    });
    setBusy(false); setConvertModal(null);
    load();
  }

  function moveInDraft(index: number, by: -1 | 1) {
    setOrderDraft(d => {
      if (!d) return d;
      const next = [...d];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  async function saveOrder() {
    if (!orderDraft) return;
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/shopping/order`, { method: "PUT", body: JSON.stringify({ memberIds: orderDraft.map(p => p.id) }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the order.");
    else setOrderDraft(null);
    setBusy(false);
    load();
  }

  const step = trip ? STEP_TEXT[trip.status] : null;
  const headline = !shopper ? "Nobody is in the shopping turn yet"
    : step ? (isShopper ? step.mine : step.theirs(shopper.name))
    : isShopper ? "It's your turn to shop" : `${shopper.name}'s turn to shop`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Shopping</h1>
      <p className="mt-1 text-sm text-gray-500">One shared list. Everyone takes turns doing the shopping.</p>

      {/* Whose turn, and the trip steps */}
      <section className={`mt-5 rounded-2xl border px-5 py-5 ${isShopper ? "border-brand bg-brand text-white" : "border-gray-200 bg-white"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${isShopper ? "text-white/80" : "text-gray-500"}`}>
          {trip ? "Shopping trip" : "Shopping turn"}
        </p>
        <p className={`mt-1 text-xl font-bold ${isShopper ? "" : "text-gray-900"}`}>{headline}</p>
        {state?.next && !trip && <p className={`mt-0.5 text-sm ${isShopper ? "text-white/85" : "text-gray-500"}`}>Next: {state.next.name}</p>}
        {!trip && state?.lastTrip && (
          <p className={`mt-0.5 text-xs ${isShopper ? "text-white/75" : "text-gray-400"}`}>
            Last trip: {state.lastTrip.shopperName}, {new Date(state.lastTrip.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {state.lastTrip.itemCount} {state.lastTrip.itemCount === 1 ? "item" : "items"}
          </p>
        )}

        {isShopper && !confirmFinish && (
          <div className="mt-4 space-y-2">
            {!trip ? (
              <button onClick={() => tripAction("start")} disabled={busy} className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-brand disabled:opacity-60">Start preparing</button>
            ) : step!.action === "finish" ? (
              <button onClick={() => setConfirmFinish(true)} disabled={busy} className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-brand disabled:opacity-60">Finish trip</button>
            ) : (
              <button onClick={() => tripAction(step!.action)} disabled={busy} className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-brand disabled:opacity-60">{step!.label}</button>
            )}
            {trip && (
              <div className="flex justify-between text-xs text-white/85">
                <button onClick={() => tripAction("cancel")} disabled={busy} className="hover:underline">Cancel trip</button>
                {trip.status === "SHOPPING" && <button onClick={() => setConfirmFinish(true)} disabled={busy} className="hover:underline">Finish now</button>}
              </div>
            )}
          </div>
        )}

        {isShopper && confirmFinish && (
          <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm">
            <p className="font-semibold">Finish this trip?</p>
            <p className="mt-1 text-white/85">
              {inCart.length} ticked {inCart.length === 1 ? "item leaves" : "items leave"} the list.
              {pending.length > 0 && ` ${pending.length} unticked ${pending.length === 1 ? "item stays" : "items stay"} for next time.`}
              {state?.next && state.next.id !== me.id && ` Then it's ${state.next.name}'s turn.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => tripAction("finish")} disabled={busy} className="flex-1 rounded-lg bg-white py-2 text-sm font-semibold text-brand disabled:opacity-60">Finish trip</button>
              <button onClick={() => setConfirmFinish(false)} className="flex-1 rounded-lg border border-white/40 py-2 text-sm font-medium">Not yet</button>
            </div>
          </div>
        )}
      </section>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      {allFlags.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-amber-700">Household dietary needs</p>
          <div className="flex flex-wrap gap-1.5">
            {allFlags.map(flag => (
              <span key={flag} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{DIETARY_LABELS[flag] ?? flag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Add to the shared list */}
      <form onSubmit={addItem} className="mt-4 flex gap-2">
        <input type="text" required placeholder="Add an item…" value={newName} onChange={e => setNewName(e.target.value)} aria-label="Item name"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <input type="text" placeholder="Qty" value={newQty} onChange={e => setNewQty(e.target.value)} aria-label="Quantity"
          className="w-16 rounded-xl border border-gray-300 px-3 py-2.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <button type="submit" disabled={busy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">Add</button>
      </form>

      {/* The list */}
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="font-medium text-gray-800">The list is empty</p>
          <p className="mt-1 text-sm text-gray-500">Anyone at home can add what&apos;s needed.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {pending.length > 0 && (
            <ItemList title={`To get (${pending.length})`}>
              {pending.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setPurchased(item, true)} aria-label={`Tick ${item.name}`}
                    className="h-7 w-7 flex-shrink-0 rounded-full border-2 border-gray-300 hover:border-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}{item.quantity !== "1" && <span className="text-gray-500"> × {item.quantity}</span>}</p>
                    <p className="text-xs text-gray-400">Added by {item.addedBy.id === me.id ? "you" : item.addedBy.name}</p>
                  </div>
                  <button onClick={() => deleteItem(item.id)} aria-label={`Remove ${item.name}`} className="px-1 text-lg text-gray-300 hover:text-red-500">×</button>
                </li>
              ))}
            </ItemList>
          )}
          {inCart.length > 0 && (
            <ItemList title={`In the cart (${inCart.length})`}>
              {inCart.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setPurchased(item, false)} aria-label={`Untick ${item.name}`}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <p className="min-w-0 flex-1 text-sm text-gray-500 line-through">{item.name}</p>
                  <button onClick={() => setConvertModal({ item, category: "SUPPLIES", unit: "units", reorderThreshold: "1", expiryDate: "" })}
                    className="text-xs font-medium text-brand hover:underline">Add to inventory</button>
                </li>
              ))}
            </ItemList>
          )}
          {inCart.length > 0 && !trip && (
            <p className="text-center text-xs text-gray-400">Ticked items leave the list when the shopper finishes their trip.</p>
          )}
        </div>
      )}

      {/* Admins: the shopping order */}
      {me.isAdmin && state && state.order.length > 1 && (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Shopping order</h2>
            {!orderDraft && !trip && <button onClick={() => setOrderDraft(state.order)} className="text-xs font-medium text-brand hover:underline">Change</button>}
          </div>
          {trip && <p className="mt-1 text-xs text-gray-500">You can change the order once the current trip is finished.</p>}
          <ol className="mt-3 space-y-1.5">
            {(orderDraft ?? state.order).map((p, i, list) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-gray-800">
                <span className="w-5 text-right text-xs text-gray-400">{i + 1}.</span>
                <span className="flex-1">{p.name}{p.id === shopper?.id && !orderDraft && <span className="ml-2 text-xs text-brand">current turn</span>}</span>
                {orderDraft && (
                  <>
                    <button onClick={() => moveInDraft(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`} className="rounded border border-gray-200 px-2 text-xs disabled:opacity-30">↑</button>
                    <button onClick={() => moveInDraft(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${p.name} down`} className="rounded border border-gray-200 px-2 text-xs disabled:opacity-30">↓</button>
                  </>
                )}
              </li>
            ))}
          </ol>
          {orderDraft && (
            <div className="mt-3">
              <p className="text-xs text-gray-500">The first person shops next.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={saveOrder} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Save order</button>
                <button onClick={() => setOrderDraft(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium">Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Add a bought item to inventory */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
            <div>
              <h3 className="font-semibold text-gray-900">Add &ldquo;{convertModal.item.name}&rdquo; to inventory</h3>
              <p className="mt-1 text-sm text-gray-500">So the household knows it&apos;s at home.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">Category
                <select value={convertModal.category} onChange={e => setConvertModal(m => m && { ...m, category: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  {["SUPPLIES", "FOOD", "APPLIANCE", "OTHER"].map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Unit
                <input type="text" value={convertModal.unit} onChange={e => setConvertModal(m => m && { ...m, unit: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">Running low below
                <input type="number" min="0" value={convertModal.reorderThreshold} onChange={e => setConvertModal(m => m && { ...m, reorderThreshold: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">Expiry date
                <input type="date" value={convertModal.expiryDate} onChange={e => setConvertModal(m => m && { ...m, expiryDate: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={convertToInventory} disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">Add to inventory</button>
              <button onClick={() => setConvertModal(null)} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ItemList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  );
}
