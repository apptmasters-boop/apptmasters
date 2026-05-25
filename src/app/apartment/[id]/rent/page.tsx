"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const METHODS = ["VENMO", "PAYPAL", "CASHAPP", "CASH", "BANK"] as const;
const PAYMENT_LINKS: Record<string, (name: string, amount: number) => string> = {
  VENMO: (name, amt) => `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(name)}&amount=${amt}`,
  PAYPAL: (_, amt) => `https://www.paypal.com/paypalme/pay?amount=${amt}`,
  CASHAPP: (name, amt) => `https://cash.app/$${encodeURIComponent(name)}/${amt}`,
};

interface RentPayment {
  id: string; amount: number; status: string; method: string | null; paidAt: string | null;
  user: { id: string; name: string };
}
interface RentCycle {
  id: string; month: string; totalAmount: number; markedPaidAt: string | null;
  rentPayer: { id: string; name: string };
  payments: RentPayment[];
}
interface RentConfig {
  totalAmount: number; dueDay: number; landlordName: string | null;
  rentPayerId: string; autoRotate: boolean; shares: string;
}

export default function RentPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [config, setConfig] = useState<RentConfig | null>(null);
  const [cycles, setCycles] = useState<RentCycle[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [configForm, setConfigForm] = useState({
    totalAmount: "", dueDay: "1", landlordName: "", rentPayerId: "", autoRotate: false,
  });

  async function load() {
    const [confRes, cyclesRes, aptRes, meRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/rent/config`),
      apiFetch(`/api/apartments/${apartmentId}/rent/cycles`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
    ]);
    if (confRes.status === 401) { router.replace("/login"); return; }
    const confData = confRes.ok ? await confRes.json() : null;
    setConfig(confData);
    setCycles(await cyclesRes.json());
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { role: string; user: { id: string; name: string } }) => ({ ...m.user, role: m.role })));
    setIsAdmin(apt.currentUserRole === "ADMIN");
    const me = await meRes.json();
    setCurrentUserId(me.id);
    if (confData) {
      setConfigForm({
        totalAmount: String(confData.totalAmount),
        dueDay: String(confData.dueDay),
        landlordName: confData.landlordName ?? "",
        rentPayerId: confData.rentPayerId ?? "",
        autoRotate: confData.autoRotate,
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch(`/api/apartments/${apartmentId}/rent/config`, {
      method: "POST",
      body: JSON.stringify({ ...configForm, totalAmount: parseFloat(configForm.totalAmount), dueDay: parseInt(configForm.dueDay) }),
    });
    setShowSetup(false);
    load();
  }

  async function createCycle() {
    setCreatingCycle(true);
    const month = new Date().toISOString().slice(0, 7);
    await apiFetch(`/api/apartments/${apartmentId}/rent/cycles`, {
      method: "POST", body: JSON.stringify({ month }),
    });
    setCreatingCycle(false);
    load();
  }

  async function updatePayment(cycleId: string, paymentId: string, status: string, method?: string) {
    await apiFetch(`/api/apartments/${apartmentId}/rent/cycles/${cycleId}/payments/${paymentId}`, {
      method: "PATCH", body: JSON.stringify({ status, ...(method ? { method } : {}) }),
    });
    load();
  }

  function exportRentCSV() {
    const rows = [
      ["Month", "Total", "My Share", "My Status", "Paid At"],
      ...cycles.flatMap(cycle =>
        cycle.payments
          .filter(p => p.user.id === currentUserId)
          .map(p => [
            cycle.month,
            cycle.totalAmount.toFixed(2),
            p.amount.toFixed(2),
            p.status,
            p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "",
          ])
      ),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const currentCycle = cycles[0];
  const isRentPayer = currentCycle?.rentPayer.id === currentUserId || config?.rentPayerId === currentUserId;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}/finance`} className="text-sm text-gray-400 hover:text-gray-600">← Finance</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Rent</span>
        </div>
        <div className="flex items-center gap-3">
          {cycles.length > 0 && (
            <button onClick={exportRentCSV} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Export CSV
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowSetup(s => !s)} className="text-sm text-indigo-600 font-medium hover:underline">
              {config ? "Edit setup" : "Setup rent"}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Setup form */}
        {showSetup && (
          <form onSubmit={saveConfig} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Rent setup</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Total rent ($)</label>
                <input type="number" required step="0.01" value={configForm.totalAmount}
                  onChange={e => setConfigForm(f => ({ ...f, totalAmount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due day of month</label>
                <input type="number" min="1" max="28" value={configForm.dueDay}
                  onChange={e => setConfigForm(f => ({ ...f, dueDay: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Landlord name</label>
                <input type="text" value={configForm.landlordName}
                  onChange={e => setConfigForm(f => ({ ...f, landlordName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Rent Payer</label>
                <select required value={configForm.rentPayerId}
                  onChange={e => setConfigForm(f => ({ ...f, rentPayerId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {members.filter(m => m.role !== "GUEST").map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={configForm.autoRotate} onChange={e => setConfigForm(f => ({ ...f, autoRotate: e.target.checked }))} />
              Auto-rotate Rent Payer monthly
            </label>
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Save</button>
              <button type="button" onClick={() => setShowSetup(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {!config ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 mb-2">Rent not configured yet.</p>
            {isAdmin && <p className="text-sm text-gray-400">Click &quot;Setup rent&quot; above to get started.</p>}
          </div>
        ) : (
          <>
            {/* Config summary */}
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">${config.totalAmount.toFixed(2)}/month</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Due on day {config.dueDay} · Rent Payer: {members.find(m => m.id === config.rentPayerId)?.name ?? "—"}
                    {config.landlordName && ` · ${config.landlordName}`}
                  </p>
                </div>
                {isAdmin && !currentCycle && (
                  <button onClick={createCycle} disabled={creatingCycle}
                    className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {creatingCycle ? "Creating…" : "Mark rent paid"}
                  </button>
                )}
                {isRentPayer && !currentCycle && (
                  <button onClick={createCycle} disabled={creatingCycle}
                    className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {creatingCycle ? "…" : "I paid the rent"}
                  </button>
                )}
              </div>
            </div>

            {/* Current cycle */}
            {cycles.map(cycle => (
              <div key={cycle.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{cycle.month}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Rent Payer: {cycle.rentPayer.name} · ${cycle.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cycle.markedPaidAt ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {cycle.markedPaidAt ? "Paid to landlord" : "Pending"}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {cycle.payments.map(payment => {
                    const isMe = payment.user.id === currentUserId;
                    const isPayerView = cycle.rentPayer.id === currentUserId;
                    return (
                      <div key={payment.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.user.name} {isMe ? "(you)" : ""}</p>
                          <p className="text-xs text-gray-400">${payment.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            payment.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                            payment.status === "PAID" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-500"}`}>
                            {payment.status}
                          </span>
                          {isMe && payment.status === "PENDING" && (
                            <div className="flex gap-1">
                              {METHODS.map(method => {
                                const link = PAYMENT_LINKS[method]?.(cycle.rentPayer.name, payment.amount);
                                return link ? (
                                  <a key={method} href={link} target="_blank" rel="noopener noreferrer"
                                    onClick={() => updatePayment(cycle.id, payment.id, "PAID", method)}
                                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded font-medium hover:bg-indigo-100 transition-colors">
                                    {method}
                                  </a>
                                ) : (
                                  <button key={method} onClick={() => updatePayment(cycle.id, payment.id, "PAID", method)}
                                    className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded font-medium hover:bg-gray-100 transition-colors">
                                    {method}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {isPayerView && payment.status === "PAID" && (
                            <button onClick={() => updatePayment(cycle.id, payment.id, "CONFIRMED")}
                              className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg font-medium hover:bg-green-100 transition-colors">
                              Confirm
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
