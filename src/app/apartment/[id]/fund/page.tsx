"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface FundTransaction {
  id: string; type: string; amount: number; description: string; createdAt: string;
  user: { id: string; name: string };
}

export default function FundPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "CONTRIBUTION", amount: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await apiFetch(`/api/apartments/${apartmentId}/fund`);
    if (res.status === 401) { router.replace("/login"); return; }
    const data = await res.json();
    setBalance(data.balance);
    setTransactions(data.transactions);
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/fund`, {
      method: "POST",
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Something went wrong");
      setSaving(false);
      return;
    }
    setForm({ type: "CONTRIBUTION", amount: "", description: "" });
    setShowForm(false);
    setSaving(false);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Apartment Fund</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-violet-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-violet-700 transition-colors">
            + Transaction
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Balance card */}
        <div className="bg-violet-600 text-white rounded-2xl px-6 py-6">
          <p className="text-sm text-violet-200 mb-1">Current balance</p>
          <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
          <p className="text-xs text-violet-300 mt-2">Shared pool for apartment supplies & expenses</p>
        </div>

        {/* Transaction form */}
        {showForm && (
          <form onSubmit={submit} className="bg-white border border-violet-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New transaction</h3>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              {(["CONTRIBUTION", "WITHDRAWAL"] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t
                    ? t === "CONTRIBUTION" ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-500 text-white border-red-500"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {t === "CONTRIBUTION" ? "+ Contribute" : "− Withdraw"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount ($)</label>
              <input required type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input required type="text" placeholder="e.g. Monthly supplies budget" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }}
                className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {/* Transaction history */}
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No transactions yet.</p>
            <p className="text-sm text-gray-400 mt-1">Add a contribution to get started.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">History</p>
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-400">{tx.user.name} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === "CONTRIBUTION" ? "text-emerald-600" : "text-red-500"}`}>
                    {tx.type === "CONTRIBUTION" ? "+" : "−"}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
