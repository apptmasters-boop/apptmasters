"use client";
/**
 * Money tab (docs/PRODUCT_LOGIC.md §11): Overview | Activity | Balances, all
 * from the household's ledger (src/lib/ledger.ts), so rent and shared
 * expenses are counted together. It only says "All settled up" when nothing is
 * owed at all, rent included (§11.2). Adding expenses, rent and fund
 * movements still happens on their own pages, linked from the Overview.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { HubSection } from "@/components/home/HubPage";
import { ScaleIcon, CalendarIcon, DollarIcon } from "@/components/landing/icons";
import NotificationBell from "@/components/NotificationBell";
import { position, net, unpaidRent, toConfirm, type Debt, type SummaryEntry } from "@/lib/moneySummary";

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
}

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
  const [tab, setTab] = useState<Tab>("overview");
  const [shown, setShown] = useState(ACTIVITY_PAGE);

  useEffect(() => {
    let current = true;
    apiFetch(`/api/apartments/${apartmentId}/ledger`)
      .then(async res => {
        if (!current) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const data = await res.json();
        if (current) setLedger(data);
      })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [apartmentId, router]);

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

      {ledger && tab === "overview" && <Overview ledger={ledger} apartmentId={apartmentId} />}
      {ledger && tab === "activity" && <Activity ledger={ledger} shown={shown} onMore={() => setShown(n => n + ACTIVITY_PAGE)} />}
      {ledger && tab === "balances" && <Balances ledger={ledger} />}

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

function Overview({ ledger, apartmentId }: { ledger: Ledger; apartmentId: string }) {
  const { me, names, entries } = ledger;
  const { owe, owed } = position(ledger.debts, me);
  const rentNet = net(ledger.bySource.rent, me);
  const expenseNet = net(ledger.bySource.expense, me);
  const rentDue = unpaidRent(entries, me);
  const confirm = toConfirm(entries, me);
  const now = new Date();
  const who = (id: string) => names[id] ?? "Someone";
  const part = (label: string, n: number) => (n > 0 ? `${label}: you owe ${money(n)}` : n < 0 ? `${label}: you're owed ${money(n)}` : null);
  const parts = [part("Rent", rentNet), part("Shared expenses", expenseNet)].filter(Boolean);

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

      <div className="rounded-2xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">What&apos;s next</h2>
        {rentDue.length === 0 && confirm.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">Nothing waiting for you.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {rentDue.map(r => {
              const late = !r.waiting && r.due < now;
              return (
                <li key={r.id}>
                  <Link href={`/apartment/${apartmentId}/rent`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{r.label}: your share to {who(r.to)}</span>
                      <span className={`block text-xs ${late ? "font-semibold text-red-600" : "text-gray-500"}`}>
                        {r.waiting ? `Waiting for ${who(r.to)} to confirm` : late ? `Overdue since ${day(r.due)}` : `Due ${day(r.due)}`}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{money(r.amount)}</span>
                  </Link>
                </li>
              );
            })}
            {confirm.map(p => (
              <li key={p.id}>
                <Link href={`/apartment/${apartmentId}/${p.source === "rent" ? "rent" : "finance"}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{who(p.from)} says they paid you</span>
                    <span className="block text-xs text-gray-500">{p.label.replace(" (waiting for confirmation)", "")} · tap to confirm</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{money(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-600">Shared fund</span>
        <span className="text-sm font-semibold text-gray-900">{money(ledger.fundBalance)}</span>
      </div>
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
  const newestFirst = [...ledger.entries].reverse();
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

function Balances({ ledger }: { ledger: Ledger }) {
  const { me, names, debts, bySource } = ledger;
  const who = (id: string) => (id === me ? "You" : names[id] ?? "Someone");
  const sorted = [...debts].sort((a, b) => Number(b.from === me || b.to === me) - Number(a.from === me || a.to === me) || b.amount - a.amount);

  if (sorted.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-5">
        <p className="font-semibold text-gray-900">Nobody owes anybody</p>
        <p className="mt-0.5 text-sm text-gray-500">Rent and shared expenses are all settled in this household.</p>
      </div>
    );
  }
  return (
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
            <span className="text-sm font-semibold text-gray-900">{money(d.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}
