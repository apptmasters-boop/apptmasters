"use client";
/**
 * Money tab (docs/PRODUCT_LOGIC.md §11): Overview | Activity | Balances, all
 * from the household's ledger (src/lib/ledger.ts), so rent and shared
 * expenses are counted together. It only says "All settled up" when nothing is
 * owed at all, rent included (§11.2). Adding expenses, rent and fund
 * movements still happens on their own pages, linked from the Overview.
 * Paying someone back is "Record payment" on Balances; the person paid
 * confirms it on Balances too, under "Payments to confirm" (Sprint 5c,
 * src/lib/payments.ts; moved from the Overview's "What's next" box, which the
 * owner removed: fix F17, 2026-10-18).
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { HubSection } from "@/components/home/HubPage";
import { ScaleIcon, CalendarIcon, DollarIcon } from "@/components/landing/icons";
import NotificationBell from "@/components/NotificationBell";
import { position, net, type Debt, type SummaryEntry } from "@/lib/moneySummary";

const TABS = ["overview", "activity", "balances"] as const;
type Tab = (typeof TABS)[number];
const ACTIVITY_PAGE = 60;

interface Ledger {
  me: string;
  names: Record<string, string>;
  entries: (SummaryEntry & { date: string })[];
  debts: Debt[];
  bySource: { expense: Debt[]; rent: Debt[] };
  fundBalance: number;
  payments: RecordedPayment[];
}
interface RecordedPayment {
  id: string; from: string; to: string; amount: number; method: string; note: string | null;
  status: "PENDING" | "CONFIRMED"; createdAt: string; respondedAt: string | null; items: string[];
}

const METHODS: Record<string, string> = {
  CASH: "Cash", BANK: "Bank transfer", VENMO: "Venmo", ZELLE: "Zelle", CASHAPP: "Cash App", PAYPAL: "PayPal", OTHER: "Other",
};

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
const day = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Signed amount `from` owes `to` in a list of debts (negative = `to` owes `from`). */
const between = (debts: Debt[], from: string, to: string) =>
  debts.filter(d => d.from === from && d.to === to).reduce((s, d) => s + d.amount, 0)
  - debts.filter(d => d.from === to && d.to === from).reduce((s, d) => s + d.amount, 0);

export default function MoneyPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [failed, setFailed] = useState(false);
  const asked = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(asked as Tab) ? (asked as Tab) : "overview");
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  const [paying, setPaying] = useState<string | null>(null); // who the Record payment dialog is for

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${apartmentId}/ledger`)
      .then(async res => {
        if (!isCurrent()) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const data = await res.json();
        if (isCurrent()) setLedger(data);
      })
      .catch(() => { if (isCurrent()) setFailed(true); }), [apartmentId, router]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const at = (path: string) => `/apartment/${apartmentId}/${path}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Money</h1>
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <p className="mt-1 text-sm text-gray-500">Rent, shared expenses and the household fund, in one place.</p>

      <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-medium capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {failed && <p className="mt-6 text-sm text-red-600">Money couldn&apos;t load. Try again in a minute.</p>}
      {!ledger && !failed && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {ledger && tab === "overview" && <Overview ledger={ledger} />}
      {ledger && tab === "activity" && <Activity ledger={ledger} shown={shown} onMore={() => setShown(n => n + ACTIVITY_PAGE)} />}
      {ledger && tab === "balances" && <Balances ledger={ledger} apartmentId={apartmentId} onPay={setPaying} onChange={() => load()} />}
      {ledger && paying && (
        <RecordPayment apartmentId={apartmentId} to={paying} name={ledger.names[paying] ?? "them"}
          onClose={() => setPaying(null)} onDone={() => { setPaying(null); setTab("balances"); load(); }} />
      )}

      <div className="mt-8">
        <HubSection title="Add and manage" items={[
          { href: at("rent"), label: "Rent", description: "This month's rent, who has paid, confirmations", icon: CalendarIcon },
          { href: at("finance"), label: "Shared expenses", description: "Add an expense, settle up, confirm cash", icon: ScaleIcon },
          { href: at("fund"), label: "Shared fund", description: "The household's common pot", icon: DollarIcon },
        ]} />
      </div>
    </main>
  );
}

function Overview({ ledger }: { ledger: Ledger }) {
  const { me } = ledger;
  const { owe, owed } = position(ledger.debts, me);
  const rentNet = net(ledger.bySource.rent, me);
  const expenseNet = net(ledger.bySource.expense, me);
  const part = (label: string, n: number) => (n > 0 ? `${label}: you owe ${money(n)}` : n < 0 ? `${label}: you're owed ${money(n)}` : null);
  const parts = [part("Rent", rentNet), part("Shared expenses", expenseNet)].filter(Boolean);

  // No "What's next" box (owner, fix F17, 2026-10-18): payments to confirm are on Balances;
  // rent and cash confirmations on the Rent and Shared expenses pages.
  return (
    <section className="mt-5 space-y-4">
      {owe === 0 && owed === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
          <p className="text-xl font-bold text-gray-900">All settled up</p>
          <p className="mt-0.5 text-sm text-gray-500">Nobody owes you anything and you don&apos;t owe anyone, rent included.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border px-5 py-4 ${owe > 0 ? "border-brand bg-brand text-white" : "border-gray-200 bg-white"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${owe > 0 ? "text-white/80" : "text-gray-500"}`}>You owe</p>
            <p className={`mt-1 text-2xl font-bold ${owe > 0 ? "" : "text-gray-900"}`}>{money(owe)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">You&apos;re owed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{money(owed)}</p>
          </div>
        </div>
      )}
      {parts.length > 0 && <p className="px-1 text-sm text-gray-600">{parts.join(" · ")}</p>}

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-600">Shared fund</span>
        <span className="text-sm font-semibold text-gray-900">{money(ledger.fundBalance)}</span>
      </div>
    </section>
  );
}

/**
 * Payments recorded with "Record payment" that wait for an answer (Sprint 5c): the ones
 * paid to you (Confirm / I didn't receive it) and yours (Cancel). On Balances since fix
 * F17; only when there are any.
 */
function PaymentsToConfirm({ ledger, apartmentId, onChange }: { ledger: Ledger; apartmentId: string; onChange: () => void }) {
  const { me, names } = ledger;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toAnswer = ledger.payments.filter(p => p.status === "PENDING" && p.to === me);
  const sent = ledger.payments.filter(p => p.status === "PENDING" && p.from === me);
  const who = (id: string) => names[id] ?? "Someone";
  async function answer(paymentId: string, action: "confirm" | "decline" | "cancel") {
    setBusy(paymentId); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/payments/${paymentId}`, { method: "POST", body: JSON.stringify({ action }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
    setBusy(null);
    onChange();
  }
  if (toAnswer.length + sent.length === 0 && !error) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Payments to confirm</h2>
      <ul className="divide-y divide-gray-50">
        {toAnswer.map(p => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{who(p.from)} says they paid you</span>
                <span className="block text-xs text-gray-500">{METHODS[p.method] ?? p.method} · {p.items.join(", ")}{p.note ? ` · "${p.note}"` : ""}</span>
              </span>
              <span className="text-sm font-semibold text-gray-900">{money(p.amount)}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => answer(p.id, "confirm")} disabled={busy === p.id} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Confirm</button>
              <button onClick={() => answer(p.id, "decline")} disabled={busy === p.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium disabled:opacity-60">I didn&apos;t receive it</button>
            </div>
          </li>
        ))}
        {sent.map(p => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900">Waiting for {who(p.to)} to confirm your payment</span>
              <span className="block text-xs text-gray-500">{money(p.amount)} · {METHODS[p.method] ?? p.method} · {day(p.createdAt)}</span>
            </span>
            <button onClick={() => answer(p.id, "cancel")} disabled={busy === p.id} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60">Cancel</button>
          </li>
        ))}
      </ul>
      {error && <p className="px-4 py-2 text-sm text-red-600" role="alert">{error}</p>}
    </section>
  );
}

/** One sentence per entry, with "you" for the viewer. */
function describe(e: SummaryEntry, me: string, names: Record<string, string>) {
  const who = (id: string, capital = true) => (id === me ? (capital ? "You" : "you") : names[id] ?? "Someone");
  switch (e.kind) {
    case "EXPENSE_SHARE":
    case "RENT_SHARE": return `${who(e.from)} ${e.from === me ? "owe" : "owes"} ${who(e.to, false)}`;
    case "PAYMENT": return `${who(e.from)} paid ${who(e.to, false)}${e.pending ? " · waiting for confirmation" : ""}`;
    case "MARKED_SETTLED": return `${who(e.from)} ${e.from === me ? "are" : "is"} settled with ${who(e.to, false)}`;
    case "FUND_IN": return `${who(e.from)} added to the fund`;
    case "FUND_OUT": return `${who(e.from)} took from the fund`;
    default: return "";
  }
}

const KIND_BADGE: Record<string, { text: string; className: string }> = {
  EXPENSE_SHARE: { text: "Expense", className: "bg-gray-100 text-gray-700" },
  RENT_SHARE: { text: "Rent", className: "bg-indigo-50 text-indigo-700" },
  PAYMENT: { text: "Payment", className: "bg-green-50 text-green-700" },
  MARKED_SETTLED: { text: "Settled", className: "bg-green-50 text-green-700" },
  FUND_IN: { text: "Fund", className: "bg-amber-50 text-amber-800" },
  FUND_OUT: { text: "Fund", className: "bg-amber-50 text-amber-800" },
};

function Activity({ ledger, shown, onMore }: { ledger: Ledger; shown: number; onMore: () => void }) {
  // A recorded payment is one line, instead of one per item it covers.
  const paymentLines: (SummaryEntry & { date: string })[] = ledger.payments.map(p => ({
    id: `payment:${p.id}`, kind: "PAYMENT", source: "payment", from: p.from, to: p.to, amount: p.amount,
    date: p.respondedAt ?? p.createdAt, pending: p.status === "PENDING",
    label: `Payment (${METHODS[p.method] ?? p.method})${p.items.length ? `: ${p.items.join(", ")}` : ""}`,
  }));
  const newestFirst = [...ledger.entries.filter(e => !(e.kind === "PAYMENT" && e.paymentId)), ...paymentLines]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const page = newestFirst.slice(0, shown);
  const months: { month: string; items: typeof page }[] = [];
  for (const e of page) {
    const month = new Date(e.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (months.at(-1)?.month !== month) months.push({ month, items: [] });
    months.at(-1)!.items.push(e);
  }

  if (newestFirst.length === 0) {
    return <p className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">No money activity yet.</p>;
  }
  return (
    <section className="mt-5 space-y-5">
      {months.map(({ month, items }) => (
        <div key={month}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{month}</h2>
          <ul className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {items.map(e => {
              const badge = KIND_BADGE[e.kind];
              return (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-3 ${e.pending ? "opacity-70" : ""}`}>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge?.className ?? ""}`}>{badge?.text}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{e.label}</span>
                    <span className="block text-xs text-gray-500">{describe(e, ledger.me, ledger.names)} · {day(e.date)}</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{money(e.amount)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {newestFirst.length > shown && (
        <button onClick={onMore} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Show older</button>
      )}
    </section>
  );
}

function Balances({ ledger, apartmentId, onPay, onChange }: { ledger: Ledger; apartmentId: string; onPay: (userId: string) => void; onChange: () => void }) {
  const { me, names, debts, bySource } = ledger;
  const who = (id: string) => (id === me ? "You" : names[id] ?? "Someone");
  const sorted = [...debts].sort((a, b) => Number(b.from === me || b.to === me) - Number(a.from === me || a.to === me) || b.amount - a.amount);

  const payments = <PaymentsToConfirm ledger={ledger} apartmentId={apartmentId} onChange={onChange} />;
  if (sorted.length === 0) {
    return (
      <>
        {payments}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
          <p className="font-semibold text-gray-900">Nobody owes anybody</p>
          <p className="mt-0.5 text-sm text-gray-500">Rent and shared expenses are all settled in this household.</p>
        </div>
      </>
    );
  }
  return (
    <>
      {payments}
      <ul className="mt-5 divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {sorted.map(d => {
          const mine = d.from === me || d.to === me;
          const rent = between(bySource.rent, d.from, d.to);
          const expenses = between(bySource.expense, d.from, d.to);
          const split = [rent && `Rent ${rent > 0 ? "" : "−"}${money(rent)}`, expenses && `Shared expenses ${expenses > 0 ? "" : "−"}${money(expenses)}`].filter(Boolean);
          return (
            <li key={`${d.from}-${d.to}`} className={`flex items-center justify-between gap-3 px-4 py-3 ${mine ? "bg-brand-soft/50" : ""}`}>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">
                  {who(d.from)} {d.from === me ? "owe" : "owes"} {d.to === me ? "you" : who(d.to)}
                </span>
                {split.length > 0 && <span className="block text-xs text-gray-500">{split.join(" · ")}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">{money(d.amount)}</span>
                {d.from === me && (
                  <button onClick={() => onPay(d.to)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Record payment</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface OpenItem { type: "expense" | "rent"; id: string; label: string; amount: number; date: string }

/** Money → Balances → Record payment: choose what you're paying `to` for, how, and send it for them to confirm. */
function RecordPayment({ apartmentId, to, name, onClose, onDone }: {
  apartmentId: string; to: string; name: string; onClose: () => void; onDone: () => void;
}) {
  const [items, setItems] = useState<{ owe: OpenItem[]; offset: OpenItem[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = (i: OpenItem) => `${i.type}:${i.id}`;

  useEffect(() => {
    let current = true;
    apiFetch(`/api/apartments/${apartmentId}/payments?with=${encodeURIComponent(to)}`)
      .then(res => (res.ok ? res.json() : { owe: [], offset: [] }))
      .then((data: { owe: OpenItem[]; offset: OpenItem[] }) => {
        if (!current) return;
        setItems(data);
        setPicked(new Set([...data.owe, ...data.offset].map(i => `${i.type}:${i.id}`))); // everything ticked to start with
      })
      .catch(() => { if (current) setItems({ owe: [], offset: [] }); });
    return () => { current = false; };
  }, [apartmentId, to]);

  const sum = (list: OpenItem[]) => list.filter(i => picked.has(key(i))).reduce((s, i) => s + Math.round(i.amount * 100), 0);
  const total = items ? (sum(items.owe) - sum(items.offset)) / 100 : 0;
  const toggle = (i: OpenItem) => setPicked(p => {
    const next = new Set(p);
    if (next.has(key(i))) next.delete(key(i)); else next.add(key(i));
    return next;
  });

  async function send() {
    if (!items) return;
    setSending(true); setError(null);
    const chosen = (list: OpenItem[]) => list.filter(i => picked.has(key(i))).map(i => ({ type: i.type, id: i.id }));
    const res = await apiFetch(`/api/apartments/${apartmentId}/payments`, {
      method: "POST", body: JSON.stringify({ toUserId: to, owe: chosen(items.owe), offset: chosen(items.offset), method, note }),
    });
    setSending(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't record it. Try again.");
  }

  const row = (i: OpenItem, minus: boolean) => (
    <li key={key(i)}>
      <label className="flex items-center gap-3 px-1 py-2">
        <input type="checkbox" checked={picked.has(key(i))} onChange={() => toggle(i)} className="h-4 w-4 accent-brand" />
        <span className="min-w-0 flex-1 text-sm text-gray-800">
          {i.label}
          <span className="block text-xs text-gray-500">{i.type === "rent" ? "Rent" : "Shared expense"} · {day(i.date)}</span>
        </span>
        <span className="text-sm font-medium text-gray-900">{minus ? "−" : ""}{money(i.amount)}</span>
      </label>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Record a payment to ${name}`}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-lg font-semibold text-gray-900">Record a payment to {name}</h3>
        <p className="mt-0.5 text-sm text-gray-500">Tick what you&apos;re paying for. {name} confirms once they&apos;ve received it.</p>

        {!items ? <p className="mt-4 text-sm text-gray-400">Loading…</p> : (
          <>
            {items.owe.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600">Nothing you owe {name} can be paid here right now. Items already waiting for confirmation aren&apos;t listed.</p>
            ) : (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">You owe {name}</p>
                <ul className="divide-y divide-gray-100">{items.owe.map(i => row(i, false))}</ul>
              </>
            )}
            {items.offset.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{name} owes you (subtracted)</p>
                <ul className="divide-y divide-gray-100">{items.offset.map(i => row(i, true))}</ul>
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">How you paid
                <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900">
                  {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Note (optional)
                <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={300} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-lg font-bold text-gray-900">{total > 0 ? money(total) : "$0.00"}</span>
            </div>
            {total <= 0 && items.owe.length > 0 && <p className="mt-2 text-xs text-gray-500">Tick at least one thing you&apos;re paying for, worth more than what they owe you.</p>}
            {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={send} disabled={!items || total <= 0 || sending} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {sending ? "Sending…" : `Send${total > 0 ? ` ${money(total)}` : ""}`}
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

