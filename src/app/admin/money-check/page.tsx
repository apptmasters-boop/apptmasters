"use client";
/**
 * Admin → Money check (Sprint 5a). The new Money ledger is built alongside
 * today's Money page; this report shows, household by household, whether both
 * give the same shared-expense balances, and the rent still owed that today's
 * page leaves out. Nothing switches over until every household shows ✓.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Line { from: string; to: string; fromName: string; toName: string }
interface Household {
  id: string; name: string; expensesMatch: boolean;
  expenseDifferences: (Line & { current: number; ledger: number })[];
  rentOwed: (Line & { amount: number })[];
  fund: { stored: number; fromMovements: number; matches: boolean };
  counts: { expenseShares: number; rentShares: number; waitingForConfirmation: number };
}
interface Report { checkedAt: string; allExpensesMatch: boolean; households: Household[] }

const money = (n: number) => `$${n.toFixed(2)}`;

export default function MoneyCheckPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    apiFetch("/api/admin/money-check")
      .then(async res => {
        if (!current) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.status === 403) { router.replace("/dashboard"); return; }
        if (!res.ok) { setError("The check couldn't run. Try again in a minute."); return; }
        const data = await res.json();
        if (current) setReport(data);
      })
      .catch(() => { if (current) setError("The check couldn't run. Try again in a minute."); });
    return () => { current = false; };
  }, [router]);

  const mismatched = report?.households.filter(h => !h.expensesMatch).length ?? 0;
  const withRent = report?.households.filter(h => h.rentOwed.length > 0).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="font-bold text-gray-900">Money check</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-gray-600">
          The new Money ledger is built alongside today&apos;s Money page. For every household, it must give the
          same shared-expense balances before anything switches over. Rent still owed is new: today&apos;s Money page
          leaves it out.
        </p>

        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        {!report && !error && <p className="mt-6 text-sm text-gray-400">Checking every household…</p>}

        {report && (
          <>
            <div className={`mt-6 rounded-2xl border px-5 py-4 ${report.allExpensesMatch ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className={`font-semibold ${report.allExpensesMatch ? "text-green-800" : "text-red-800"}`}>
                {report.allExpensesMatch
                  ? `✓ All ${report.households.length} households match`
                  : `✗ ${mismatched} of ${report.households.length} households differ`}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {withRent} {withRent === 1 ? "household has" : "households have"} rent still owed · checked {new Date(report.checkedAt).toLocaleString()}
              </p>
            </div>

            <ul className="mt-6 space-y-3">
              {report.households.map(h => (
                <li key={h.id} className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{h.name}</p>
                      <p className="text-xs text-gray-500">
                        {h.counts.expenseShares} expense shares · {h.counts.rentShares} rent shares
                        {h.counts.waitingForConfirmation > 0 && ` · ${h.counts.waitingForConfirmation} payments waiting for confirmation`}
                      </p>
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${h.expensesMatch ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {h.expensesMatch ? "✓ Expenses match" : "✗ Expenses differ"}
                    </span>
                  </div>

                  {h.expenseDifferences.length > 0 && (
                    <table className="mt-3 w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-500"><th className="font-medium">Who owes whom</th><th className="text-right font-medium">Money page today</th><th className="text-right font-medium">New ledger</th></tr></thead>
                      <tbody>
                        {h.expenseDifferences.map(d => (
                          <tr key={`${d.from}-${d.to}`} className="border-t border-gray-100">
                            <td className="py-1.5">{d.fromName} → {d.toName}</td>
                            <td className="py-1.5 text-right">{money(d.current)}</td>
                            <td className="py-1.5 text-right">{money(d.ledger)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rent still owed</p>
                    {h.rentOwed.length === 0 ? (
                      <p className="mt-1 text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-sm text-gray-800">
                        {h.rentOwed.map(d => <li key={`${d.from}-${d.to}`}>{d.fromName} owes {d.toName} <span className="font-semibold">{money(d.amount)}</span></li>)}
                      </ul>
                    )}
                  </div>

                  {!h.fund.matches && (
                    <p className="mt-3 text-sm text-amber-700">
                      Shared fund: the stored balance is {money(h.fund.stored)}, but its movements add up to {money(h.fund.fromMovements)}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
