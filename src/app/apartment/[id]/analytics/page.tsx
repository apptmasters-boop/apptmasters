"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Analytics {
  byCategory: Record<string, number>;
  byMonth: Record<string, { total: number; myShare: number }>;
  topSpenders: { name: string; total: number }[];
  totalLast6Months: number;
  myShareLast6Months: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  RENT: "#4f46e5", FOOD: "#10b981", UTILITIES: "#f59e0b",
  CLEANING: "#06b6d4", MAINTENANCE: "#ef4444", GENERAL: "#8b5cf6",
  ENTERTAINMENT: "#ec4899", TRANSPORT: "#f97316",
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">${value.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/apartments/${apartmentId}/analytics`).then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.ok) setData(await res.json());
      setLoading(false);
    });
  }, [apartmentId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!data) return null;

  const months = Object.keys(data.byMonth).sort();
  const maxMonthTotal = Math.max(...Object.values(data.byMonth).map(m => m.total), 1);
  const categories = Object.entries(data.byCategory).sort(([, a], [, b]) => b - a);
  const maxCategory = categories[0]?.[1] ?? 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href={`/apartment/${apartmentId}/finance`} className="text-sm text-gray-400 hover:text-gray-600">← Finance</Link>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-900">Expense Analytics</span>
        <span className="text-xs text-gray-400">Last 6 months</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Total spending</p>
            <p className="text-2xl font-bold text-gray-900">${data.totalLast6Months.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">last 6 months</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Your share</p>
            <p className="text-2xl font-bold text-blue-600">${data.myShareLast6Months.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {data.totalLast6Months > 0
                ? `${((data.myShareLast6Months / data.totalLast6Months) * 100).toFixed(0)}% of total`
                : "no expenses"}
            </p>
          </div>
        </div>

        {/* Monthly trend */}
        {months.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Monthly breakdown</p>
            <div className="space-y-3">
              {months.map(m => (
                <div key={m} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{m}</span>
                    <span className="font-medium text-gray-900">${data.byMonth[m].total.toFixed(0)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-blue-500 rounded-l-full transition-all duration-700"
                      style={{ width: `${(data.byMonth[m].myShare / maxMonthTotal) * 100}%` }} />
                    <div className="h-full bg-blue-200 transition-all duration-700"
                      style={{ width: `${((data.byMonth[m].total - data.byMonth[m].myShare) / maxMonthTotal) * 100}%` }} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Your share: ${data.byMonth[m].myShare.toFixed(0)}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-blue-200 mr-1" />Others: ${(data.byMonth[m].total - data.byMonth[m].myShare).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By category */}
        {categories.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-900">By category</p>
            <div className="space-y-3">
              {categories.map(([cat, amt]) => (
                <Bar key={cat} label={cat} value={amt} max={maxCategory}
                  color={CATEGORY_COLORS[cat] ?? "#8b5cf6"} />
              ))}
            </div>
          </div>
        )}

        {/* Top spenders */}
        {data.topSpenders.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Who paid the most</p>
            {data.topSpenders.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900 font-medium">{s.name}</span>
                    <span className="text-gray-600">${s.total.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(s.total / data.topSpenders[0].total) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {categories.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-gray-500">No expenses in the last 6 months.</p>
          </div>
        )}
      </main>
    </div>
  );
}
