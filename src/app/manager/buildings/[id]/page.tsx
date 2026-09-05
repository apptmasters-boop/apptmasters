"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Invite { id: string; email: string; createdAt: string; }
interface Unit {
  id: string;
  number: string;
  rentAmount: number | null;
  apartment: { id: string; name: string; _count: { members: number } } | null;
  invites: Invite[];
}
interface Building {
  id: string;
  name: string;
  address: string;
  units: Unit[];
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  landlordNote: string | null;
  unitNumber: string | null;
  createdAt: string;
  submittedBy: { name: string; email: string };
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-500",
  MEDIUM: "bg-blue-100 text-blue-600",
  URGENT: "bg-red-100 text-red-600",
};
const M_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
};
const M_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

interface RentPayment { userId: string; amount: number; status: string; method: string | null; paidAt: string | null; }
interface RentUnit {
  unitId: string;
  unitNumber: string;
  rentAmount: number | null;
  status: "vacant" | "paid" | "partial" | "pending" | "no_cycle";
  tenants: { id: string; name: string; email: string }[];
  currentCycle: { month: string; total: number; payments: RentPayment[] } | null;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  pending: "bg-red-100 text-red-600",
  no_cycle: "bg-gray-100 text-gray-500",
  vacant: "bg-gray-100 text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  pending: "Unpaid",
  no_cycle: "No cycle",
  vacant: "Vacant",
};

export default function BuildingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"units" | "rent" | "maintenance">("units");
  const [building, setBuilding] = useState<Building | null>(null);
  const [rentData, setRentData] = useState<RentUnit[]>([]);
  const [maintData, setMaintData] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentLoading, setRentLoading] = useState(false);
  const [maintLoading, setMaintLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Units tab state
  const [addingUnit, setAddingUnit] = useState(false);
  const [unitNumber, setUnitNumber] = useState("");
  const [unitError, setUnitError] = useState<string | null>(null);
  const [invitingUnit, setInvitingUnit] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Rent tab state
  const [editingRent, setEditingRent] = useState<string | null>(null);
  const [rentInput, setRentInput] = useState("");
  const [savingRent, setSavingRent] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [reminded, setReminded] = useState<string | null>(null);

  async function loadBuilding() {
    const res = await apiFetch(`/api/manager/buildings/${params.id}`);
    if (res.status === 403 || res.status === 404) { router.replace("/manager"); return; }
    if (res.ok) setBuilding(await res.json());
    setLoading(false);
  }

  async function loadRent() {
    setRentLoading(true);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/rent`);
    if (res.ok) setRentData(await res.json());
    setRentLoading(false);
  }

  async function loadMaintenance() {
    setMaintLoading(true);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/maintenance`);
    if (res.ok) setMaintData(await res.json());
    setMaintLoading(false);
  }

  async function updateRequest(requestId: string, status?: string, landlordNote?: string) {
    setUpdatingId(requestId);
    const body: Record<string, string> = {};
    if (status) body.status = status;
    if (landlordNote !== undefined) body.landlordNote = landlordNote;
    await apiFetch(`/api/manager/maintenance/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setUpdatingId(null);
    setExpandedId(null);
    loadMaintenance();
  }

  useEffect(() => { loadBuilding(); }, [params.id]);
  useEffect(() => { if (tab === "rent") loadRent(); }, [tab]);
  useEffect(() => { if (tab === "maintenance") loadMaintenance(); }, [tab]);

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    setUnitError(null);
    setAddingUnit(true);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/units`, {
      method: "POST",
      body: JSON.stringify({ number: unitNumber.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setUnitError(data.error ?? "Failed to add unit"); setAddingUnit(false); return; }
    setUnitNumber("");
    setAddingUnit(false);
    loadBuilding();
  }

  async function sendInvite(unitId: string) {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/units/${unitId}/invite`, {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    if (res.ok) {
      setInviteSent(unitId);
      setInvitingUnit(null);
      setInviteEmail("");
      setTimeout(() => setInviteSent(null), 3000);
      loadBuilding();
    }
    setInviteLoading(false);
  }

  async function deleteUnit(unitId: string) {
    if (!confirm("Remove this unit? Any pending invites will be cancelled.")) return;
    setDeleting(unitId);
    await apiFetch(`/api/manager/buildings/${params.id}/units/${unitId}`, { method: "DELETE" });
    setDeleting(null);
    loadBuilding();
  }

  async function saveRent(unitId: string) {
    const amount = parseFloat(rentInput);
    if (!amount || amount <= 0) return;
    setSavingRent(unitId);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/units/${unitId}/rent`, {
      method: "PATCH",
      body: JSON.stringify({ rentAmount: amount }),
    });
    if (res.ok) { setEditingRent(null); setRentInput(""); loadRent(); loadBuilding(); }
    setSavingRent(null);
  }

  async function sendReminder(unitId: string) {
    setReminding(unitId);
    const res = await apiFetch(`/api/manager/buildings/${params.id}/units/${unitId}/rent`, {
      method: "POST",
    });
    if (res.ok) {
      setReminded(unitId);
      setTimeout(() => setReminded(null), 3000);
    }
    setReminding(null);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!building) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/manager" className="text-sm text-gray-400 hover:text-gray-600">← Buildings</Link>
          <span className="text-gray-300">|</span>
          <div>
            <span className="font-bold text-gray-900">{building.name}</span>
            <span className="text-xs text-gray-400 ml-2">{building.address}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(["units", "rent", "maintenance"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "units" ? "Units & Invites" : t === "rent" ? "Rent" : `Maintenance${maintData.filter(r => r.status === "OPEN").length > 0 ? ` (${maintData.filter(r => r.status === "OPEN").length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ── Units Tab ── */}
        {tab === "units" && (
          <div className="space-y-6">
            <form onSubmit={addUnit} className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  type="text" placeholder="Unit number (e.g. 101, A, 2B)…" value={unitNumber}
                  onChange={e => { setUnitNumber(e.target.value); setUnitError(null); }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {unitError && <p className="text-xs text-red-500 mt-1">{unitError}</p>}
              </div>
              <button type="submit" disabled={addingUnit || !unitNumber.trim()}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {addingUnit ? "Adding…" : "+ Add unit"}
              </button>
            </form>

            {building.units.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">🚪</p>
                <p className="text-gray-500 font-medium">No units yet</p>
                <p className="text-sm text-gray-400 mt-1">Add units above to start sending tenant invites.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {building.units.map(unit => (
                  <div key={unit.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">Unit {unit.number}</p>
                        {unit.rentAmount && (
                          <p className="text-xs text-gray-400">${unit.rentAmount.toLocaleString()}/mo</p>
                        )}
                        {unit.apartment ? (
                          <div className="mt-0.5">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Occupied</span>
                            <p className="text-xs text-gray-400 mt-1">{unit.apartment._count.members} tenant{unit.apartment._count.members !== 1 ? "s" : ""}</p>
                          </div>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block">Vacant</span>
                        )}
                      </div>
                      <button onClick={() => deleteUnit(unit.id)} disabled={deleting === unit.id}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50">
                        Remove
                      </button>
                    </div>

                    {unit.invites.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {unit.invites.map(inv => (
                          <div key={inv.id} className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">Pending</span>
                            <span className="text-xs text-gray-500 truncate">{inv.email}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {invitingUnit === unit.id ? (
                      <div className="flex gap-2">
                        <input
                          type="email" placeholder="tenant@email.com" value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)} autoFocus
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={() => sendInvite(unit.id)} disabled={inviteLoading || !inviteEmail.trim()}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {inviteLoading ? "Sending…" : "Send"}
                        </button>
                        <button onClick={() => { setInvitingUnit(null); setInviteEmail(""); }}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setInvitingUnit(unit.id); setInviteEmail(""); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        {inviteSent === unit.id ? "✓ Invite sent!" : "+ Send invite"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Rent Tab ── */}
        {tab === "rent" && (
          <div className="space-y-4">
            {rentLoading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading rent data…</p>
            ) : rentData.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">💸</p>
                <p className="text-gray-500 font-medium">No units yet</p>
                <p className="text-sm text-gray-400 mt-1">Add units in the Units tab first.</p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-3">
                  {(["paid", "pending", "vacant"] as const).map(s => {
                    const count = rentData.filter(u => u.status === s || (s === "pending" && (u.status === "pending" || u.status === "partial" || u.status === "no_cycle") && u.tenants.length > 0)).length;
                    return (
                      <div key={s} className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{rentData.filter(u => u.status === s).length}</p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">{STATUS_LABELS[s]}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Unit rent rows */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {rentData.map(unit => (
                    <div key={unit.unitId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">Unit {unit.unitNumber}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[unit.status]}`}>
                              {STATUS_LABELS[unit.status]}
                            </span>
                          </div>

                          {unit.tenants.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {unit.tenants.map(t => t.name).join(", ")}
                            </p>
                          )}

                          {unit.currentCycle && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {unit.currentCycle.month} · ${unit.currentCycle.total.toLocaleString()} total
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Rent amount */}
                          {editingRent === unit.unitId ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-400">$</span>
                              <input
                                type="number" value={rentInput} onChange={e => setRentInput(e.target.value)}
                                autoFocus placeholder="0"
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button onClick={() => saveRent(unit.unitId)} disabled={savingRent === unit.unitId}
                                className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {savingRent === unit.unitId ? "…" : "Save"}
                              </button>
                              <button onClick={() => { setEditingRent(null); setRentInput(""); }}
                                className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingRent(unit.unitId); setRentInput(unit.rentAmount?.toString() ?? ""); }}
                              className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                              {unit.rentAmount ? `$${unit.rentAmount.toLocaleString()}/mo` : "Set rent"}
                            </button>
                          )}

                          {/* Reminder */}
                          {unit.tenants.length > 0 && unit.status !== "paid" && (
                            <button onClick={() => sendReminder(unit.unitId)} disabled={reminding === unit.unitId}
                              className={`text-xs font-medium transition-colors disabled:opacity-50 ${reminded === unit.unitId ? "text-green-600" : "text-orange-500 hover:text-orange-700"}`}>
                              {reminding === unit.unitId ? "Sending…" : reminded === unit.unitId ? "Sent ✓" : "Remind"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {/* ── Maintenance Tab ── */}
        {tab === "maintenance" && (
          <div className="space-y-3">
            {maintLoading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : maintData.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">🔧</p>
                <p className="text-gray-500 font-medium">No maintenance requests</p>
                <p className="text-sm text-gray-400 mt-1">Tenants can submit requests from their apartment home.</p>
              </div>
            ) : (
              maintData.map(r => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {r.unitNumber && <span className="text-xs text-gray-400 font-medium">Unit {r.unitNumber}</span>}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[r.priority]}`}>{r.priority}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${M_STATUS_STYLES[r.status]}`}>{M_STATUS_LABELS[r.status]}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{r.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                      <p className="text-xs text-gray-400 mt-1">by {r.submittedBy.name} · {new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0">
                      {expandedId === r.id ? "Close" : "Update"}
                    </button>
                  </div>

                  {r.landlordNote && expandedId !== r.id && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Your note</p>
                      <p className="text-sm text-blue-800">{r.landlordNote}</p>
                    </div>
                  )}

                  {expandedId === r.id && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Update status</label>
                        <div className="flex gap-2">
                          {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const).map(s => (
                            <button key={s} type="button"
                              onClick={() => updateRequest(r.id, s, noteInputs[r.id])}
                              disabled={updatingId === r.id || r.status === s}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${r.status === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"}`}>
                              {M_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Note to tenant (optional)</label>
                        <div className="flex gap-2">
                          <input
                            type="text" placeholder="e.g. Plumber coming Friday…"
                            value={noteInputs[r.id] ?? r.landlordNote ?? ""}
                            onChange={e => setNoteInputs(n => ({ ...n, [r.id]: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => updateRequest(r.id, undefined, noteInputs[r.id] ?? "")}
                            disabled={updatingId === r.id}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {updatingId === r.id ? "…" : "Save note"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
