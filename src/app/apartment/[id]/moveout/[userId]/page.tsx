"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface MoveOutData {
  user: { id: string; name: string; email: string; moveInDate: string | null };
  membership: { joinedAt: string; movedOutAt: string | null; role: string } | null;
  summary: {
    totalRentPaid: number; pendingRent: number; choresCompleted: number;
    totalExpenseOwed: number; totalExpensePaid: number; outstandingBalance: number;
  };
  rentPayments: { id: string; amount: number; status: string; paidAt: string | null; rentCycle: { month: string; totalAmount: number } }[];
  expenseSplits: { id: string; amount: number; status: string; expense: { title: string; amount: number; date: string } }[];
  score: { score: number; logs: { id: string; delta: number; reason: string; createdAt: string }[] };
}

function scoreTier(score: number) {
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export default function MoveOutReportPage() {
  const { id: apartmentId, userId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<MoveOutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/apartments/${apartmentId}/moveout/${userId}`).then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace(`/apartment/${apartmentId}`); return; }
      setData(await res.json());
      setLoading(false);
    });
  }, [apartmentId, userId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!data) return null;

  const { user, membership, summary, rentPayments, expenseSplits, score } = data;
  const tier = scoreTier(score.score);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header — hidden when printing */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}/scores`} className="text-sm text-gray-400 hover:text-gray-600">← Scores</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Move-Out Report</span>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const { generateMoveOutPDF } = await import("@/lib/pdf");
            const apt = await apiFetch(`/api/apartments/${apartmentId}`).then(r => r.json());
            generateMoveOutPDF({
              memberName: user.name,
              apartmentName: apt.name,
              movedOutAt: membership?.movedOutAt ?? new Date().toISOString(),
              totalPaid: summary.totalExpensePaid,
              totalOwed: summary.totalExpenseOwed,
              balance: summary.outstandingBalance,
              expenses: expenseSplits.map(s => ({
                title: s.expense.title,
                amount: s.expense.amount,
                myShare: s.amount,
                paidByMe: false,
                date: s.expense.date,
              })),
              rentHistory: rentPayments.map(r => ({
                month: r.rentCycle.month,
                amount: r.amount,
                status: r.status,
              })),
            });
          }} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Download PDF
          </button>
          <button onClick={() => window.print()}
            className="text-sm border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Print
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 print:px-0 print:py-4">
        {/* Title block */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 print:border-0 print:rounded-none">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Move-Out Report</p>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          <div className="flex gap-6 mt-3 text-sm text-gray-600">
            {user.moveInDate && <span>Moved in: <strong>{new Date(user.moveInDate).toLocaleDateString()}</strong></span>}
            {membership?.joinedAt && <span>Joined apt: <strong>{new Date(membership.joinedAt).toLocaleDateString()}</strong></span>}
            <span>Report generated: <strong>{new Date().toLocaleDateString()}</strong></span>
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Rent paid", value: `$${summary.totalRentPaid.toFixed(2)}`, highlight: false },
            { label: "Pending rent", value: `$${summary.pendingRent.toFixed(2)}`, highlight: summary.pendingRent > 0 },
            { label: "Chores completed", value: String(summary.choresCompleted), highlight: false },
            { label: "Expenses owed", value: `$${summary.totalExpenseOwed.toFixed(2)}`, highlight: false },
            { label: "Expenses paid", value: `$${summary.totalExpensePaid.toFixed(2)}`, highlight: false },
            { label: "Outstanding balance", value: `$${Math.abs(summary.outstandingBalance).toFixed(2)}${summary.outstandingBalance > 0 ? " owed" : summary.outstandingBalance < 0 ? " credit" : ""}`, highlight: summary.outstandingBalance > 0 },
          ].map(item => (
            <div key={item.label} className={`bg-white border rounded-xl px-4 py-3 ${item.highlight ? "border-red-300" : "border-gray-200"}`}>
              <p className="text-xs text-gray-400 font-medium">{item.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${item.highlight ? "text-red-600" : "text-gray-900"}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Score */}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Roommate Score</p>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold text-gray-900">{score.score}</span>
            <div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${tier === "Great" ? "bg-emerald-100 text-emerald-700" : tier === "Good" ? "bg-blue-100 text-blue-700" : tier === "Fair" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {tier}
              </span>
              <p className="text-xs text-gray-400 mt-1">Out of 100 · Based on chores, rent, and behaviour</p>
            </div>
          </div>
          {score.logs.length > 0 && (
            <div className="mt-4 space-y-1">
              {score.logs.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-gray-600">{log.reason}</span>
                  <span className={log.delta >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                    {log.delta >= 0 ? "+" : ""}{log.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rent payments */}
        {rentPayments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              Rent history ({rentPayments.length})
            </p>
            <div className="divide-y divide-gray-50">
              {rentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.rentCycle.month}</p>
                    <p className="text-xs text-gray-400">{p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString()}` : "Not paid"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${p.amount.toFixed(2)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : p.status === "PAID" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense splits */}
        {expenseSplits.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              Expense splits ({expenseSplits.length})
            </p>
            <div className="divide-y divide-gray-50">
              {expenseSplits.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.expense.title}</p>
                    <p className="text-xs text-gray-400">{new Date(s.expense.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${s.amount.toFixed(2)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">Generated by ApptMasters · {new Date().toLocaleDateString()}</p>
      </main>
    </div>
  );
}
