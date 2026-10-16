"use client";
/**
 * More → Insights (docs/PRODUCT_LOGIC.md §19): household numbers from the same
 * sources as Money and Household (src/lib/insights.ts), replacing the separate
 * Stats and Analytics pages. Charts follow the app's chart rules: one series,
 * one color (--chart-mark, contrast-checked on light and dark), thin bars
 * rounded at the value end, a value on each column, a hover/focus readout, and
 * a table view.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/home/HomeNav";
import NotificationBell from "@/components/NotificationBell";
import { pageClass } from "@/components/home/useApartment";
import { apiFetch } from "@/lib/api";

interface Month { month: string; label: string; total: number; mine: number }
interface Insights {
  me: string;
  months: Month[];
  categories: { category: string; total: number }[];
  totals: { sixMonths: number; thisMonth: number; mineThisMonth: number };
  rent: { month: string; label: string; totalAmount: number; expected: number; collected: number; stillToCollect: number; landlordPaid: boolean }[];
  debts: { from: string; to: string; amount: number; fromName: string; toName: string }[];
  people: { userId: string; name: string; paid: number; share: number; cleanings: number; trips: number; tripsTotal: number; choresDone: number; choresToDo: number; choresOverdue: number }[];
}

const CATEGORY: Record<string, string> = {
  GENERAL: "General", GROCERIES: "Groceries", UTILITIES: "Utilities", SUPPLIES: "Supplies", DINING: "Dining", TRANSPORT: "Transport", OTHER: "Other",
};
const money = (n: number) => `$${n.toFixed(2)}`;
const compact = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`);

export default function InsightsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    apiFetch(`/api/apartments/${apartmentId}/insights`)
      .then(async res => {
        if (!current) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const json = await res.json();
        if (current) setData(json);
      })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [apartmentId, router]);

  const who = (id: string, name: string) => (id === data?.me ? "You" : name);

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Insights</h1>
      <p className="mt-1 text-sm text-gray-500">How the household is doing, from the same numbers as Money and Household.</p>

      {failed && <p className="mt-6 text-sm text-red-600">Insights couldn&apos;t load. Try again in a minute.</p>}
      {!data && !failed && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {data && (
        <div className="mt-6 space-y-8">
          {/* Headline numbers */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Household spending this month" value={money(data.totals.thisMonth)} />
            <Tile label="Your share this month" value={money(data.totals.mineThisMonth)} />
            <Tile label="Household spending, last 6 months" value={money(data.totals.sixMonths)} />
          </div>

          <Section title="Spending by month" note="Shared expenses and shopping trips. Hover or tap a month for your share.">
            <MonthChart months={data.months} />
          </Section>

          <Section title="By category" note="Last 6 months">
            {data.categories.length === 0 ? <Empty text="No shared expenses yet." /> : <CategoryBars categories={data.categories} />}
          </Section>

          <Section title="Rent" note="The same months as Money → Rent">
            {data.rent.length === 0 ? <Empty text="No rent recorded in the last 6 months." /> : (
              <Table head={["Month", "Rent", "Collected from roommates", "Landlord"]}
                rows={data.rent.slice().reverse().map(r => [
                  r.label, money(r.totalAmount),
                  r.expected > 0 ? `${money(r.collected)} of ${money(r.expected)}` : "None to collect",
                  r.landlordPaid ? "Paid" : "Not paid yet",
                ])} />
            )}
          </Section>

          <Section title="Who owes whom now" note="Rent and shared expenses, as on Money → Balances">
            {data.debts.length === 0 ? <Empty text="Nobody owes anybody." /> : (
              <ul className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {data.debts.map(d => (
                  <li key={`${d.from}-${d.to}`} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-gray-800">{who(d.from, d.fromName)} {d.from === data.me ? "owe" : "owes"} {d.to === data.me ? "you" : d.toName}</span>
                    <span className="font-semibold tabular-nums text-gray-900">{money(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Who does what" note="Money: last 6 months · cleaning, shopping and chores: last 3 months">
            <Table head={["", "Paid for the home", "Their share", "Cleanings", "Shopping trips", "Chores done", "Chores to do"]}
              rows={data.people.map(p => [
                who(p.userId, p.name), money(p.paid), money(p.share), String(p.cleanings),
                p.trips ? `${p.trips} (${money(p.tripsTotal)})` : "0", String(p.choresDone),
                p.choresOverdue ? `${p.choresToDo} (${p.choresOverdue} late)` : String(p.choresToDo),
              ])} />
          </Section>
        </div>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">{text}</p>;

/** Columns for the 6 months: value on each cap, a readout on hover or focus, and a table view. */
function MonthChart({ months }: { months: Month[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...months.map(m => m.total), 1);
  const PLOT = 120; // px for the tallest column

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
      <div className="mb-2 flex justify-end">
        <button onClick={() => setAsTable(t => !t)} className="text-xs font-medium text-gray-500 hover:text-gray-800">{asTable ? "Show as chart" : "Show as table"}</button>
      </div>
      {asTable ? (
        <Table head={["Month", "Household", "Your share"]} rows={months.map(m => [m.label, money(m.total), money(m.mine)])} bare />
      ) : (
        <>
          <div className="flex items-end gap-2 border-b border-gray-200" style={{ height: PLOT + 24 }}>
            {months.map(m => (
              <div key={m.month} tabIndex={0} role="img" aria-label={`${m.label}: household ${money(m.total)}, your share ${money(m.mine)}`}
                onMouseEnter={() => setActive(m.month)} onMouseLeave={() => setActive(a => (a === m.month ? null : a))}
                onFocus={() => setActive(m.month)} onBlur={() => setActive(a => (a === m.month ? null : a))}
                className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <span className="mb-1 text-[11px] tabular-nums text-gray-600">{m.total > 0 ? compact(m.total) : ""}</span>
                <span className="block w-full max-w-6 rounded-t bg-chart" style={{ height: Math.round((m.total / max) * PLOT) }} />
                {active === m.month && (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs shadow-sm">
                    <span className="block font-semibold text-gray-900">{money(m.total)} household</span>
                    <span className="block text-gray-700">{money(m.mine)} your share</span>
                    <span className="block text-gray-500">{m.label}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {months.map(m => <span key={m.month} className="flex-1 text-center text-xs text-gray-500">{m.label.split(" ")[0]}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

/** Categories, largest first: one bar each, the value at the tip. */
function CategoryBars({ categories }: { categories: { category: string; total: number }[] }) {
  const max = Math.max(...categories.map(c => c.total), 1);
  const sum = categories.reduce((s, c) => s + c.total, 0) || 1;
  return (
    <ul className="space-y-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-4">
      {categories.map(c => (
        <li key={c.category} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-gray-700">{CATEGORY[c.category] ?? c.category}</span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="block h-3 rounded-r bg-chart" style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }} />
            <span className="shrink-0 tabular-nums text-xs text-gray-700">{money(c.total)} · {Math.round((c.total / sum) * 100)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows, bare = false }: { head: string[]; rows: string[][]; bare?: boolean }) {
  return (
    <div className={bare ? "overflow-x-auto" : "overflow-x-auto rounded-2xl border border-gray-200 bg-white"}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            {head.map((h, i) => <th key={i} className={`px-4 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => <td key={j} className={`px-4 py-2.5 ${j > 0 ? "text-right tabular-nums text-gray-700" : "font-medium text-gray-900"}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
