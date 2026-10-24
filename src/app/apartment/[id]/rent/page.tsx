"use client";
/**
 * Money → Rent (docs/PRODUCT_LOGIC.md §12). Each month has two separate facts:
 * did the rent payer pay the landlord, and has each roommate paid back the rent
 * payer (§12.1). This month is shown in full (§12.2); earlier months are one
 * line each and open on tap (§12.3). Rules live in src/lib/rent.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/home/HomeNav";
import NotificationBell from "@/components/NotificationBell";
import { useApartment, pageClass } from "@/components/home/useApartment";
import { apiFetch } from "@/lib/api";

interface Member { paymentId: string; userId: string; name: string; amount: number; status: string; method: string | null; paidAt: string | null; confirmedAt: string | null }
interface RentMonth {
  id: string; month: string; label: string; due: string; late: boolean; totalAmount: number;
  rentPayer: { id: string; name: string }; landlordPaidAt: string | null;
  payerShare: number; expected: number; collected: number; waiting: number; stillToCollect: number;
  members: Member[];
}
interface RentSummary {
  me: string; isAdmin: boolean;
  config: { totalAmount: number; dueDay: number; landlordName: string | null; rentPayer: { id: string; name: string } | null; shares: Record<string, number>; autoRotate: boolean } | null;
  thisMonth: string; thisMonthLabel: string; thisMonthDue?: string; thisMonthStartsOn?: string | null; canStartMonth?: boolean;
  months: RentMonth[];
}

const METHODS: Record<string, string> = {
  CASH: "Cash", BANK: "Bank transfer", VENMO: "Venmo", ZELLE: "Zelle", CASHAPP: "Cash App", PAYPAL: "PayPal", OTHER: "Other",
};
const money = (n: number) => `$${n.toFixed(2)}`;
/** A YYYY-MM-DD date shown as "Oct 23", the same day in every time zone. */
const dueDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const day = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function RentPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const { apt } = useApartment(apartmentId);
  const [summary, setSummary] = useState<RentSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${apartmentId}/rent/summary`)
      .then(async res => {
        if (!isCurrent()) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setFailed(true); return; }
        const data = await res.json();
        if (isCurrent()) setSummary(data);
      })
      .catch(() => { if (isCurrent()) setFailed(true); }), [apartmentId, router]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  async function startMonth() {
    if (!summary) return;
    setStarting(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/rent/cycles`, { method: "POST", body: JSON.stringify({ month: summary.thisMonth }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't start this month's rent.");
    setStarting(false);
    load();
  }

  function exportMyRent() {
    if (!summary) return;
    const rows = [["Month", "Total rent", "My share", "Status", "Paid on"]];
    for (const m of summary.months) {
      const mine = m.members.find(x => x.userId === summary.me);
      if (mine) rows.push([m.label, m.totalAmount.toFixed(2), mine.amount.toFixed(2), mine.status, mine.paidAt ? day(mine.paidAt) : ""]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const thisMonth = summary?.months.find(m => m.month === summary.thisMonth) ?? null;
  const history = summary?.months.filter(m => m.month !== summary.thisMonth) ?? [];

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between">
        <BackLink />
        <NotificationBell apartmentId={apartmentId} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rent</h1>
          {summary?.config && (
            <p className="mt-1 text-sm text-gray-500">
              {money(summary.config.totalAmount)} a month · due on day {summary.config.dueDay}
              {summary.config.rentPayer && ` · ${summary.config.rentPayer.id === summary.me ? "You pay" : `${summary.config.rentPayer.name} pays`} the landlord`}
              {summary.config.landlordName && ` (${summary.config.landlordName})`}
            </p>
          )}
        </div>
        {summary?.isAdmin && (
          <button onClick={() => setShowSetup(s => !s)} className="shrink-0 text-sm font-medium text-brand hover:underline">
            {summary.config ? "Edit setup" : "Set up rent"}
          </button>
        )}
      </div>

      {failed && <p className="mt-6 text-sm text-red-600">Rent couldn&apos;t load. Try again in a minute.</p>}
      {!summary && !failed && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {summary && showSetup && apt && (
        <RentSetup apartmentId={apartmentId} summary={summary} members={apt.members.filter(m => m.role !== "GUEST" && m.status === "ACTIVE").map(m => m.user)}
          onDone={() => { setShowSetup(false); load(); }} onCancel={() => setShowSetup(false)} />
      )}

      {summary && !summary.config && !showSetup && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
          <p className="font-medium text-gray-800">Rent isn&apos;t set up yet</p>
          <p className="mt-1 text-sm text-gray-500">{summary.isAdmin ? "Set the amount, the due day and who pays the landlord." : "A household admin can set it up."}</p>
        </div>
      )}

      {summary?.config && (
        <>
          <h2 className="mt-6 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">This month</h2>
          {thisMonth ? (
            <MonthCard month={thisMonth} me={summary.me} isAdmin={summary.isAdmin} apartmentId={apartmentId} landlordName={summary.config.landlordName} onChange={() => load()} />
          ) : (
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-5 py-5">
              <p className="text-lg font-bold text-gray-900">{summary.thisMonthLabel}</p>
              <p className="mt-0.5 text-sm text-gray-500">{money(summary.config.totalAmount)} due {summary.thisMonthDue ? dueDay(summary.thisMonthDue) : ""}.
                {summary.thisMonthStartsOn && ` It starts by itself on ${dueDay(summary.thisMonthStartsOn)}, 3 days before it's due.`}</p>
              {summary.canStartMonth ? (
                <>
                  <button onClick={startMonth} disabled={starting} className="mt-4 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {starting ? "Starting…" : `Start ${summary.thisMonthLabel.split(" ")[0]}'s rent`}
                  </button>
                  <p className="mt-2 text-xs text-gray-500">Start it now if you want to collect early. Paying the landlord is a separate step.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">{summary.config.rentPayer ? `${summary.config.rentPayer.name} starts it.` : "Choose a rent payer in the setup."}</p>
              )}
              {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
            </div>
          )}

          {history.length > 0 && (
            <>
              <div className="mt-8 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">History</h2>
                <button onClick={exportMyRent} className="text-xs font-medium text-gray-500 hover:text-gray-800">Export my rent (CSV)</button>
              </div>
              <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {history.map(m => (
                  <li key={m.id}>
                    <button onClick={() => setOpenMonth(o => (o === m.id ? null : m.id))} aria-expanded={openMonth === m.id}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-gray-50">
                      <span className="text-sm font-medium text-gray-900">{m.label}</span>
                      <span className="flex items-center gap-2 text-sm">
                        {!m.landlordPaidAt && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Landlord not paid</span>}
                        <span className={m.stillToCollect > 0 ? "font-semibold text-red-600" : "text-green-700"}>
                          {m.stillToCollect > 0 ? `${money(m.stillToCollect)} still to collect` : "Paid"}
                        </span>
                        <span className="text-gray-400" aria-hidden="true">{openMonth === m.id ? "▾" : "▸"}</span>
                      </span>
                    </button>
                    {openMonth === m.id && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3">
                        <MonthCard month={m} me={summary.me} isAdmin={summary.isAdmin} apartmentId={apartmentId} landlordName={summary.config!.landlordName} onChange={() => load()} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** One month's summary (§12.2): landlord payment, collection from roommates, each roommate's status. */
function MonthCard({ month, me, isAdmin, apartmentId, landlordName, onChange }: {
  month: RentMonth; me: string; isAdmin: boolean; apartmentId: string; landlordName: string | null; onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [method, setMethod] = useState("CASH");
  const isPayer = month.rentPayer.id === me;
  const canManage = isPayer || isAdmin;
  const unpaid = month.members.filter(m => m.status === "PENDING");
  const pct = month.expected > 0 ? Math.round((month.collected / month.expected) * 100) : 100;
  const payerName = isPayer ? "you" : month.rentPayer.name;

  async function call(key: string, path: string, init: RequestInit, done?: (body: Record<string, unknown>) => string | null) {
    setBusy(key); setMessage(null);
    const res = await apiFetch(path, init);
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? (done?.(body) ?? null) : (body.error ?? "Something went wrong. Try again."));
    setBusy(null); setPayingId(null);
    onChange();
  }
  const landlord = (paid: boolean) => call("landlord", `/api/apartments/${apartmentId}/rent/cycles/${month.id}/landlord`, { method: "POST", body: JSON.stringify({ paid }) });
  const markPaid = (m: Member) => call(m.paymentId, `/api/apartments/${apartmentId}/rent/cycles/${month.id}/payments/${m.paymentId}`, { method: "PATCH", body: JSON.stringify({ status: "PAID", method }) });
  const confirm = (m: Member) => call(m.paymentId, `/api/apartments/${apartmentId}/rent/cycles/${month.id}/payments/${m.paymentId}`, { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) });
  const remind = () => call("remind", `/api/apartments/${apartmentId}/rent/remind`, { method: "POST", body: JSON.stringify({ cycleId: month.id }) },
    b => (typeof b.reminded === "number" ? `Reminder sent to ${b.reminded} ${b.reminded === 1 ? "person" : "people"}.` : String(b.message ?? "")));

  return (
    <div className="mt-2 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <p className="text-lg font-bold text-gray-900">{month.label}</p>
          <p className={`text-sm ${month.late && month.stillToCollect > 0 ? "font-medium text-red-600" : "text-gray-500"}`}>
            {money(month.totalAmount)} · due {dueDay(month.due)}{month.late && month.stillToCollect > 0 ? " · late" : ""}
          </p>
        </div>
        <span className="text-xs text-gray-500">Rent payer: {isPayer ? "you" : month.rentPayer.name}</span>
      </div>

      {/* Fact 1: the landlord payment */}
      <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
        <span className="text-sm text-gray-800">
          <span className="font-semibold">Landlord{landlordName ? ` (${landlordName})` : ""}:</span>{" "}
          {month.landlordPaidAt ? `paid ${day(month.landlordPaidAt)}` : "not paid yet"}
        </span>
        {canManage && (month.landlordPaidAt ? (
          <button onClick={() => landlord(false)} disabled={busy === "landlord"} className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60">Undo</button>
        ) : (
          <button onClick={() => landlord(true)} disabled={busy === "landlord"} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">I paid the landlord</button>
        ))}
      </div>

      {/* Fact 2: collection from roommates */}
      <div className="px-5 pt-4">
        {month.expected > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-gray-900">{money(month.collected)} of {money(month.expected)} collected</span>
              {month.waiting > 0 && <span className="text-xs text-gray-500">{money(month.waiting)} waiting for confirmation</span>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Nobody shares this month&apos;s rent with the rent payer.</p>
        )}
      </div>

      <ul className="mt-3 divide-y divide-gray-50 border-t border-gray-100">
        {month.members.map(m => {
          const mine = m.userId === me;
          const chip = m.status === "CONFIRMED" ? { text: "Paid", cls: "bg-green-50 text-green-700" }
            : m.status === "PAID" ? { text: `Says paid · waiting for ${payerName}`, cls: "bg-blue-50 text-blue-700" }
            : { text: month.late ? "Not paid · late" : "Not paid", cls: month.late ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600" };
          return (
            <li key={m.paymentId} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{mine ? "You" : m.name}</span>
                  <span className="block text-xs text-gray-500">
                    {money(m.amount)}{m.method ? ` · ${METHODS[m.method] ?? m.method}` : ""}{m.confirmedAt ? ` · confirmed ${day(m.confirmedAt)}` : m.paidAt ? ` · ${day(m.paidAt)}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}>{chip.text}</span>
              </div>
              {mine && m.status === "PENDING" && payingId !== m.paymentId && (
                <button onClick={() => setPayingId(m.paymentId)} className="mt-2 text-xs font-semibold text-brand hover:underline">I paid {payerName}</button>
              )}
              {mine && payingId === m.paymentId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-500">How
                    <select value={method} onChange={e => setMethod(e.target.value)} className="ms-2 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900">
                      {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <button onClick={() => markPaid(m)} disabled={busy === m.paymentId} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Mark as paid</button>
                  <button onClick={() => setPayingId(null)} className="text-xs text-gray-500">Cancel</button>
                </div>
              )}
              {isPayer && m.status === "PAID" && (
                <button onClick={() => confirm(m)} disabled={busy === m.paymentId} className="mt-2 rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand disabled:opacity-60">Confirm I received it</button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
        <span className="text-sm text-gray-700">
          {month.stillToCollect > 0 ? <>Still to collect: <span className="font-semibold">{money(month.stillToCollect)}</span></> : <span className="text-green-700">Everyone has paid</span>}
          {month.payerShare > 0 && <span className="block text-xs text-gray-500">{isPayer ? "Your" : `${month.rentPayer.name}'s`} own part: {money(month.payerShare)}</span>}
        </span>
        {canManage && unpaid.length > 0 && (
          <button onClick={remind} disabled={busy === "remind"} className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-60">Send reminder</button>
        )}
      </div>
      {message && <p className="px-5 pb-3 text-sm text-gray-700" role="status">{message}</p>}
    </div>
  );
}

/** Household admins set the rent: amount, due day, landlord, who pays the landlord. */
function RentSetup({ apartmentId, summary, members, onDone, onCancel }: {
  apartmentId: string; summary: RentSummary; members: { id: string; name: string }[]; onDone: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    totalAmount: summary.config ? String(summary.config.totalAmount) : "",
    dueDay: summary.config ? String(summary.config.dueDay) : "1",
    landlordName: summary.config?.landlordName ?? "",
    rentPayerId: summary.config?.rentPayer?.id ?? "",
    autoRotate: summary.config?.autoRotate ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/rent/config`, {
      method: "POST",
      body: JSON.stringify({
        totalAmount: parseFloat(form.totalAmount), dueDay: parseInt(form.dueDay, 10),
        landlordName: form.landlordName || undefined, rentPayerId: form.rentPayerId,
        autoRotate: form.autoRotate,
        shares: summary.config?.shares ?? {}, // keep any custom shares
      }),
    });
    setSaving(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error === "Invalid input" ? "Check the amount, the due day (1–28) and the rent payer." : "Couldn't save the setup.");
  }

  const field = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900";
  return (
    <form onSubmit={save} className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">Rent setup</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">Total rent ($)
          <input type="number" required min="1" step="0.01" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} className={field} />
        </label>
        <label className="text-xs text-gray-500">Due day of the month
          <input type="number" required min="1" max="28" value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} className={field} />
        </label>
        <label className="text-xs text-gray-500">Landlord (optional)
          <input type="text" value={form.landlordName} onChange={e => setForm(f => ({ ...f, landlordName: e.target.value }))} className={field} />
        </label>
        <label className="text-xs text-gray-500">Who pays the landlord
          <select required value={form.rentPayerId} onChange={e => setForm(f => ({ ...f, rentPayerId: e.target.value }))} className={field}>
            <option value="">Choose…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.autoRotate} onChange={e => setForm(f => ({ ...f, autoRotate: e.target.checked }))} className="h-4 w-4 accent-brand" />
        Rotate the rent payer each month
      </label>
      <p className="text-xs text-gray-500">
        Everyone else pays the rent payer back their share each month. Each month starts by itself 3 days before the due day.
        {form.autoRotate && " With rotation, the next person (in the order people joined) takes over when a new month starts."}
      </p>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-gray-600">Cancel</button>
      </div>
    </form>
  );
}
