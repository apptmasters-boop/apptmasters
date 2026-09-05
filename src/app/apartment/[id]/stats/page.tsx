"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface MemberStat {
  userId: string; name: string; paid: number; owed: number;
  choresDone: number; choresPending: number; score: number;
}
interface RentMonth { month: string; total: number; paid: number; pending: number; confirmed: number }
interface StatsData {
  totalSpend: number; thisMonthSpend: number;
  byCategory: Record<string, number>;
  thisMonthByCategory: Record<string, number>;
  memberStats: MemberStat[];
  chores: { totalDone: number; totalPending: number; totalOverdue: number };
  rentSummary: RentMonth[];
}

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: "bg-gray-400", GROCERIES: "bg-green-500", UTILITIES: "bg-blue-500",
  SUPPLIES: "bg-teal-500", DINING: "bg-orange-500", TRANSPORT: "bg-purple-500", OTHER: "bg-gray-300",
};

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function StatsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"expenses" | "chores" | "rent">("expenses");

  useEffect(() => {
    apiFetch(`/api/apartments/${apartmentId}/stats`).then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      setStats(await res.json());
      setLoading(false);
    });
  }, [apartmentId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!stats) return null;

  const maxCat = Math.max(...Object.values(stats.byCategory), 1);
  const maxMemberPaid = Math.max(...stats.memberStats.map(m => m.paid), 1);
  const maxMemberChores = Math.max(...stats.memberStats.map(m => m.choresDone), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Stats</span>
        </div>
        <NotificationBell apartmentId={apartmentId} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Top summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Total spent</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">${stats.totalSpend.toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">This month</p>
            <p className="text-xl font-bold text-blue-600 mt-0.5">${stats.thisMonthSpend.toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Chores done</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.chores.totalDone}</p>
          </div>
        </div>

        {/* Overdue chores banner */}
        {stats.chores.totalOverdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700 font-medium">{stats.chores.totalOverdue} overdue chore{stats.chores.totalOverdue > 1 ? "s" : ""}</p>
            <Link href={`/apartment/${apartmentId}/rooms`} className="text-xs text-red-600 hover:underline font-medium">View →</Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["expenses", "chores", "rent"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Expenses tab */}
        {tab === "expenses" && (
          <div className="space-y-4">
            {/* By category */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Spending by category (all time)</p>
              <div className="space-y-3">
                {Object.entries(stats.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{cat}</span>
                        <span className="text-gray-500">${amt.toFixed(2)}</span>
                      </div>
                      <Bar pct={(amt / maxCat) * 100} color={CATEGORY_COLORS[cat] ?? "bg-gray-400"} />
                    </div>
                  ))}
                {Object.keys(stats.byCategory).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No expenses yet.</p>
                )}
              </div>
            </div>

            {/* Per member */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Per member</p>
              <div className="space-y-4">
                {stats.memberStats.map(m => (
                  <div key={m.userId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      <span className="text-gray-500">paid ${m.paid.toFixed(2)} · owed ${m.owed.toFixed(2)}</span>
                    </div>
                    <Bar pct={(m.paid / maxMemberPaid) * 100} color="bg-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chores tab */}
        {tab === "chores" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Completion by member</p>
              <div className="space-y-4">
                {stats.memberStats
                  .sort((a, b) => b.choresDone - a.choresDone)
                  .map(m => (
                    <div key={m.userId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-900">{m.name}</span>
                        <span className="text-gray-500">{m.choresDone} done · {m.choresPending} pending</span>
                      </div>
                      <Bar pct={maxMemberChores > 0 ? (m.choresDone / maxMemberChores) * 100 : 0} color="bg-emerald-500" />
                    </div>
                  ))}
              </div>
            </div>

            {/* Score leaderboard */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Score leaderboard</p>
              <div className="space-y-3">
                {[...stats.memberStats]
                  .sort((a, b) => b.score - a.score)
                  .map((m, i) => (
                    <div key={m.userId} className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-5 ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-900">{m.name}</span>
                      <div className="w-24">
                        <Bar pct={m.score} color={m.score >= 80 ? "bg-emerald-500" : m.score >= 60 ? "bg-blue-500" : m.score >= 40 ? "bg-amber-400" : "bg-red-500"} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-8 text-right">{m.score}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Rent tab */}
        {tab === "rent" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              Last 6 months
            </p>
            {stats.rentSummary.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No rent cycles yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.rentSummary.map(r => {
                  const paidPct = (r.paid / r.total) * 100;
                  return (
                    <div key={r.month} className="px-5 py-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-900">{r.month}</span>
                        <span className="text-gray-500">${r.confirmed.toFixed(2)} / ${r.total.toFixed(2)} confirmed</span>
                      </div>
                      <Bar pct={paidPct} color={paidPct >= 100 ? "bg-emerald-500" : paidPct > 0 ? "bg-amber-400" : "bg-gray-200"} />
                      {r.pending > 0 && (
                        <p className="text-xs text-amber-600 mt-1">${r.pending.toFixed(2)} still pending</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
