"use client";
/**
 * Household → Shopping (docs/PRODUCT_LOGIC.md §10). The shopper goes through
 * one card at a time (owner's flow, 2026-10-09):
 *
 *   1 Start preparing → 2 Do the inventory (or skip) → 3 I'm at the store →
 *   4 Tick items into the cart, enter the total, upload the receipt, validate →
 *   5 I've left the store (the trip ends and the turn passes on)
 *
 * Everyone else sees which step the shopper is on, and can add to the shared
 * list. The page refreshes itself every few seconds.
 */
import { BackLink } from "@/components/home/HomeNav";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const REFRESH_MS = 5000;

type TripStatus = "PREPARING" | "READY" | "SHOPPING" | "CHECKED_OUT";
interface Person { id: string; name: string }
interface Member { id: string; name: string; dietaryFlags: string }
interface GroceryItem { id: string; name: string; quantity: string; purchased: boolean; addedBy: Person }
interface InventoryItem { id: string; name: string; quantity: number; unit: string; reorderThreshold: number }
interface Trip { id: string; status: TripStatus; shopperId: string; homeCheck: string | null; totalAmount: number | null; receiptUrl: string | null }
interface ShoppingState {
  shopper: Person | null; next: Person | null; trip: Trip | null;
  order: (Person & { away: boolean })[];
  lastTrip: { endedAt: string; shopperName: string; itemCount: number; totalAmount: number | null } | null;
}

const DIETARY_LABELS: Record<string, string> = {
  VEGAN: "🌱 Vegan", VEGETARIAN: "🥦 Vegetarian", GLUTEN_FREE: "🌾 Gluten-free",
  DAIRY_FREE: "🥛 Dairy-free", NUT_FREE: "🥜 Nut-free", HALAL: "☪️ Halal", KOSHER: "✡️ Kosher",
};

const STEP_NUMBER: Record<TripStatus, number> = { PREPARING: 2, READY: 3, SHOPPING: 4, CHECKED_OUT: 5 };
const TOTAL_STEPS = 5;

/** What everyone else sees while the shopper is on each step. */
const THEIR_STEP: Record<TripStatus, (name: string) => string> = {
  PREPARING: n => `${n} is checking what's at home`,
  READY: n => `${n} is about to go shopping`,
  SHOPPING: n => `${n} is at the store`,
  CHECKED_OUT: n => `${n} has paid and is about to leave the store`,
};

const money = (n: number) => `$${n.toFixed(2)}`;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const stockLevel = (i: InventoryItem) => (i.quantity <= 0 ? "Out" : i.quantity <= i.reorderThreshold ? "Low" : "OK");

export default function ShoppingPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<ShoppingState | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState({ id: "", isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const allFlags = Array.from(new Set(members.flatMap(m => { try { return JSON.parse(m.dietaryFlags) as string[]; } catch { return []; } })));

  /** Runs a trip step; returns true when it worked. */
  async function tripAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/shopping/trip`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
    setBusy(false);
    await load();
    return res.ok;
  }

  async function addItem(name: string, quantity = "1") {
    await apiFetch(`/api/apartments/${apartmentId}/grocery`, { method: "POST", body: JSON.stringify({ name, quantity }) });
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

  async function saveOrder() {
    if (!orderDraft) return;
    setBusy(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/shopping/order`, { method: "PUT", body: JSON.stringify({ memberIds: orderDraft.map(p => p.id) }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the order.");
    else setOrderDraft(null);
    setBusy(false);
    load();
  }

  const shopperIsShopping = isShopper && trip?.status === "SHOPPING";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Shopping</h1>
      <p className="mt-1 text-sm text-gray-500">One shared list. Everyone takes turns doing the shopping.</p>

      {isShopper ? (
        <ShopperCard trip={trip} items={items} next={state?.next ?? null} meId={me.id} busy={busy} apartmentId={apartmentId}
          onAction={tripAction} onAdd={addItem} onTick={setPurchased} />
      ) : (
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{trip ? "Shopping trip" : "Shopping turn"}</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {!shopper ? "Nobody is in the shopping turn yet" : trip ? THEIR_STEP[trip.status](shopper.name) : `${shopper.name}'s turn to shop`}
          </p>
          {trip && <StepDots step={STEP_NUMBER[trip.status]} />}
          {!trip && state?.next && <p className="mt-0.5 text-sm text-gray-500">Next: {state.next.id === me.id ? "you" : state.next.name}</p>}
          {!trip && state?.lastTrip && (
            <p className="mt-0.5 text-xs text-gray-400">
              Last trip: {state.lastTrip.shopperName}, {new Date(state.lastTrip.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {state.lastTrip.totalAmount != null && ` · ${money(state.lastTrip.totalAmount)}`} · {state.lastTrip.itemCount} {state.lastTrip.itemCount === 1 ? "item" : "items"}
            </p>
          )}
        </section>
      )}
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

      {/* The shared list (inside the shopper's card while they're at the store) */}
      {!shopperIsShopping && (
        <>
          <AddItemForm onAdd={addItem} />
          {items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
              <p className="font-medium text-gray-800">The list is empty</p>
              <p className="mt-1 text-sm text-gray-500">Anyone at home can add what&apos;s needed.</p>
            </div>
          ) : (
            <ItemList title={`On the list (${items.length})`}>
              {items.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${item.purchased ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      {item.name}{item.quantity !== "1" && <span className="text-gray-500"> × {item.quantity}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{item.purchased ? "In the cart" : `Added by ${item.addedBy.id === me.id ? "you" : item.addedBy.name}`}</p>
                  </div>
                  {!item.purchased && <button onClick={() => deleteItem(item.id)} aria-label={`Remove ${item.name}`} className="px-1 text-lg text-gray-300 hover:text-red-500">×</button>}
                </li>
              ))}
            </ItemList>
          )}
        </>
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
                    <button onClick={() => setOrderDraft(d => d && swap(d, i, i - 1))} disabled={i === 0} aria-label={`Move ${p.name} up`} className="rounded border border-gray-200 px-2 text-xs disabled:opacity-30">↑</button>
                    <button onClick={() => setOrderDraft(d => d && swap(d, i, i + 1))} disabled={i === list.length - 1} aria-label={`Move ${p.name} down`} className="rounded border border-gray-200 px-2 text-xs disabled:opacity-30">↓</button>
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
    </main>
  );
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The shopper's card: exactly one step at a time. */
function ShopperCard({ trip, items, next, meId, busy, apartmentId, onAction, onAdd, onTick }: {
  trip: Trip | null; items: GroceryItem[]; next: Person | null; meId: string; busy: boolean; apartmentId: string;
  onAction: (action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  onAdd: (name: string, quantity?: string) => Promise<void>;
  onTick: (item: GroceryItem, purchased: boolean) => Promise<void>;
}) {
  const step = trip ? STEP_NUMBER[trip.status] : 1;
  const primary = "w-full rounded-xl bg-white py-3 text-sm font-semibold text-brand disabled:opacity-60";
  const nextName = next && next.id !== meId ? next.name : null;
  const [editingCheckout, setEditingCheckout] = useState(false);
  // Validating again from "Paid" goes back to the checkout form, then returns here.
  const editing = editingCheckout && trip?.status === "CHECKED_OUT";
  const validate = async (action: string, extra?: Record<string, unknown>) => {
    const ok = await onAction(action, extra);
    if (ok && action === "checkout") setEditingCheckout(false);
    return ok;
  };

  return (
    <section className="mt-5 rounded-2xl border border-brand bg-brand px-5 py-5 text-white">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/80">
        <span>Your shopping turn</span>
        <span>Step {step} of {TOTAL_STEPS}</span>
      </div>
      <StepDots step={step} light />

      {!trip && (
        <>
          <p className="mt-3 text-xl font-bold">It&apos;s your turn to shop</p>
          <p className="mt-1 text-sm text-white/85">{items.length ? `${items.length} ${items.length === 1 ? "item is" : "items are"} on the list so far.` : "Nothing on the list yet."}</p>
          <button onClick={() => onAction("start")} disabled={busy} className={`mt-4 ${primary}`}>Start preparing</button>
        </>
      )}

      {trip?.status === "PREPARING" && <InventoryStep apartmentId={apartmentId} items={items} busy={busy} onAction={onAction} onAdd={onAdd} />}

      {trip?.status === "READY" && (
        <>
          <p className="mt-3 text-xl font-bold">Ready to go</p>
          <p className="mt-1 text-sm text-white/85">{items.length} {items.length === 1 ? "item" : "items"} on the list. Tap below when you get to the store.</p>
          <button onClick={() => onAction("at_store")} disabled={busy} className={`mt-4 ${primary}`}>I&apos;m at the store</button>
        </>
      )}

      {(trip?.status === "SHOPPING" || editing) && <StoreStep trip={trip!} items={items} busy={busy} onAction={validate} onTick={onTick} />}

      {trip?.status === "CHECKED_OUT" && !editing && (
        <>
          <p className="mt-3 text-xl font-bold">Paid {trip.totalAmount != null ? money(trip.totalAmount) : ""}</p>
          <p className="mt-1 text-sm text-white/85">
            {trip.receiptUrl ? "Receipt saved." : "No receipt."} {items.filter(i => i.purchased).length} items in the cart.
            {items.some(i => !i.purchased) && ` ${items.filter(i => !i.purchased).length} not found stay on the list for next time.`}
          </p>
          {trip.receiptUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- user upload, size unknown
            <img src={trip.receiptUrl} alt="Receipt" className="mt-3 max-h-40 rounded-lg bg-white object-contain" />
          )}
          <button onClick={() => onAction("left_store")} disabled={busy} className={`mt-4 ${primary}`}>I&apos;ve left the store</button>
          <p className="mt-2 text-center text-xs text-white/75">{nextName ? `This ends your trip. Then it's ${nextName}'s turn.` : "This ends your trip."}</p>
          <button onClick={() => setEditingCheckout(true)} className="mt-2 w-full text-center text-xs text-white/75 hover:underline">Change the total or receipt</button>
        </>
      )}

      {trip && (
        <button onClick={() => { if (window.confirm("Cancel this shopping trip? The list stays as it is and it's still your turn.")) onAction("cancel"); }}
          disabled={busy} className="mt-4 block w-full text-center text-xs text-white/75 hover:underline">
          Cancel trip
        </button>
      )}
    </section>
  );
}

/** Step 2: what's low or out at home goes onto the list in one tap. Can be skipped. */
function InventoryStep({ apartmentId, items, busy, onAction, onAdd }: {
  apartmentId: string; items: GroceryItem[]; busy: boolean;
  onAction: (action: string) => Promise<boolean>; onAdd: (name: string, quantity?: string) => Promise<void>;
}) {
  const [stock, setStock] = useState<InventoryItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let current = true;
    apiFetch(`/api/apartments/${apartmentId}/inventory`)
      .then(res => (res.ok ? res.json() : []))
      .then((list: InventoryItem[]) => { if (current) setStock(list); })
      .catch(() => { if (current) setStock([]); });
    return () => { current = false; };
  }, [apartmentId]);

  const onList = (name: string) => items.some(i => !i.purchased && sameName(i.name, name));
  const needed = (stock ?? []).filter(i => stockLevel(i) !== "OK").sort((a, b) => a.quantity - b.quantity);
  const rest = (stock ?? []).filter(i => stockLevel(i) === "OK");
  const shown = showAll ? [...needed, ...rest] : needed;

  return (
    <>
      <p className="mt-3 text-xl font-bold">Do the inventory</p>
      <p className="mt-1 text-sm text-white/85">Check what&apos;s running low at home and add it to the list.</p>

      <div className="mt-3 overflow-hidden rounded-xl bg-white text-gray-900">
        {stock === null ? (
          <p className="px-4 py-4 text-sm text-gray-400">Loading the inventory…</p>
        ) : stock.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">The inventory is empty. You can add items to it from Household → Inventory.</p>
        ) : (
          <>
            {needed.length === 0 && !showAll && <p className="px-4 pt-4 text-sm text-gray-500">Nothing is low or out.</p>}
            <ul className="divide-y divide-gray-100">
              {shown.map(i => {
                const level = stockLevel(i);
                const added = onList(i.name);
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-gray-500">{i.quantity} {i.unit} at home</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${level === "Out" ? "bg-red-100 text-red-700" : level === "Low" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{level}</span>
                    <button onClick={() => onAdd(i.name)} disabled={added}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${added ? "text-brand" : "bg-brand text-white"}`}>
                      {added ? "On the list ✓" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {rest.length > 0 && (
              <button onClick={() => setShowAll(v => !v)} className="w-full border-t border-gray-100 px-4 py-2.5 text-left text-xs font-medium text-brand">
                {showAll ? "Show only low and out" : `Show everything else (${rest.length})`}
              </button>
            )}
          </>
        )}
      </div>

      <button onClick={() => onAction("inventory_done")} disabled={busy} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-brand disabled:opacity-60">Done with the inventory</button>
      <button onClick={() => onAction("skip_inventory")} disabled={busy} className="mt-2 w-full text-center text-sm font-medium text-white/85 hover:underline">Skip for now</button>
    </>
  );
}

/** Step 4: tick items into the cart, then the total and receipt, a review, and Validate. */
function StoreStep({ trip, items, busy, onAction, onTick }: {
  trip: Trip; items: GroceryItem[]; busy: boolean;
  onAction: (action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  onTick: (item: GroceryItem, purchased: boolean) => Promise<void>;
}) {
  const [total, setTotal] = useState(trip.totalAmount != null ? String(trip.totalAmount) : "");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(trip.receiptUrl);
  const [noReceipt, setNoReceipt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const inCart = items.filter(i => i.purchased);
  const toGet = items.filter(i => !i.purchased);
  const amount = Number(total.replace(",", "."));
  const totalOk = Number.isFinite(amount) && amount > 0;
  const ready = totalOk && (!!receiptUrl || noReceipt) && !uploading;

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setUploadError(null);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await apiFetch("/api/upload/receipt", { method: "POST", body: fd });
    if (res.ok) { setReceiptUrl((await res.json()).url); setNoReceipt(false); }
    else setUploadError((await res.json().catch(() => ({}))).error ?? "Upload failed. Try again.");
    setUploading(false);
  }

  if (reviewing) {
    return (
      <>
        <p className="mt-3 text-xl font-bold">Check before you validate</p>
        <dl className="mt-3 space-y-1.5 rounded-xl bg-white px-4 py-3 text-sm text-gray-900">
          <div className="flex justify-between"><dt className="text-gray-500">Total paid</dt><dd className="font-semibold">{money(amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Receipt</dt><dd>{receiptUrl ? "Uploaded" : "None"}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">In the cart</dt><dd>{inCart.length} {inCart.length === 1 ? "item" : "items"}</dd></div>
          {toGet.length > 0 && <div className="flex justify-between"><dt className="text-gray-500">Not found</dt><dd>{toGet.length} (stay on the list)</dd></div>}
        </dl>
        <p className="mt-2 text-xs text-white/75">Splitting the total between everyone comes with the new Money page.</p>
        <button onClick={() => onAction("checkout", { total: amount, ...(receiptUrl ? { receiptUrl } : { noReceipt: true }) })}
          disabled={busy} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-brand disabled:opacity-60">Validate</button>
        <button onClick={() => setReviewing(false)} className="mt-2 w-full text-center text-sm font-medium text-white/85 hover:underline">Back</button>
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-xl font-bold">You&apos;re at the store</p>
      <p className="mt-1 text-sm text-white/85">Tick each item as you put it in the cart.</p>

      <ul className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl bg-white text-gray-900">
        {items.length === 0 && <li className="px-4 py-4 text-sm text-gray-500">The list is empty.</li>}
        {[...toGet, ...inCart].map(item => (
          <li key={item.id}>
            <button onClick={() => onTick(item, !item.purchased)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 ${item.purchased ? "border-brand bg-brand text-white" : "border-gray-300"}`}>
                {item.purchased && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </span>
              <span className={`flex-1 text-base ${item.purchased ? "text-gray-400 line-through" : "font-medium"}`}>
                {item.name}{item.quantity !== "1" && <span className="text-gray-500"> × {item.quantity}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-white/75">{inCart.length} of {items.length} in the cart. New items added by others appear here.</p>

      <div className="mt-5 rounded-xl bg-white/10 p-4">
        <p className="text-sm font-semibold">Checkout</p>
        <label className="mt-3 block text-xs text-white/85">Total paid
          <div className="mt-1 flex items-center rounded-lg bg-white px-3 text-gray-900">
            <span className="text-gray-500">$</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={total} onChange={e => setTotal(e.target.value)}
              className="w-full bg-transparent px-2 py-2.5 text-base focus:outline-none" />
          </div>
        </label>

        <div className="mt-3 text-xs text-white/85">
          <p>Receipt</p>
          {receiptUrl ? (
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- user upload, size unknown */}
              <img src={receiptUrl} alt="Receipt" className="h-16 w-16 rounded-lg bg-white object-cover" />
              <button onClick={() => setReceiptUrl(null)} className="underline">Replace</button>
            </div>
          ) : (
            <label className={`mt-1 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/50 py-3 text-sm font-medium ${noReceipt ? "opacity-50" : ""}`}>
              {uploading ? "Uploading…" : "Take or choose a photo"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading || noReceipt}
                onChange={e => upload(e.target.files?.[0])} />
            </label>
          )}
          {uploadError && <p className="mt-1 text-red-100">{uploadError}</p>}
          {!receiptUrl && (
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={noReceipt} onChange={e => setNoReceipt(e.target.checked)} />
              I don&apos;t have the receipt
            </label>
          )}
        </div>

        <button onClick={() => setReviewing(true)} disabled={!ready || busy}
          className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-brand disabled:opacity-50">Review and validate</button>
        {!ready && <p className="mt-2 text-center text-xs text-white/70">Enter the total and add the receipt photo first.</p>}
      </div>
    </>
  );
}

function StepDots({ step, light = false }: { step: number; light?: boolean }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden="true">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? (light ? "bg-white" : "bg-brand") : light ? "bg-white/30" : "bg-gray-200"}`} />
      ))}
    </div>
  );
}

function AddItemForm({ onAdd }: { onAdd: (name: string, quantity?: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), qty);
    setName(""); setQty("1"); setSaving(false);
  }
  return (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input type="text" required placeholder="Add an item…" value={name} onChange={e => setName(e.target.value)} aria-label="Item name"
        className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      <input type="text" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} aria-label="Quantity"
        className="w-16 rounded-xl border border-gray-300 px-3 py-2.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      <button type="submit" disabled={saving} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">Add</button>
    </form>
  );
}

function ItemList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="divide-y divide-gray-50">{children}</ul>
    </div>
  );
}
