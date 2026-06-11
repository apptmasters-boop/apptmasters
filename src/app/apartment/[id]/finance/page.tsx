"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const CATEGORIES = ["GENERAL", "GROCERIES", "UTILITIES", "SUPPLIES", "DINING", "TRANSPORT", "OTHER"];
const METHODS = ["VENMO", "PAYPAL", "CASHAPP", "CASH", "BANK"];
const PAYMENT_LINKS: Record<string, (name: string, amount: number) => string> = {
  VENMO: (name, amt) => `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(name)}&amount=${amt}`,
  PAYPAL: (_, amt) => `https://www.paypal.com/paypalme/pay?amount=${amt}`,
  CASHAPP: (name, amt) => `https://cash.app/$${encodeURIComponent(name)}/${amt}`,
};

interface Split { userId: string; amount: number; status: string; user: { id: string; name: string } }
interface Expense {
  id: string; title: string; amount: number; category: string; splitMethod: string;
  status: string; date: string; createdAt: string; isRecurring: boolean; notes: string | null; receiptUrl: string | null;
  paidBy: { id: string; name: string };
  splits: Split[];
}
interface Balance { from: string; to: string; fromName: string; toName: string; amount: number; direction: string }
interface EditApproval { id: string; approver: { id: string; name: string }; createdAt: string }
interface EditRequest {
  id: string; status: string; requiredApprovals: number; createdAt: string;
  requesterId: string; requester: { id: string; name: string };
  expenseId: string;
  proposedTitle: string | null; proposedAmount: number | null; proposedCategory: string | null; proposedNotes: string | null;
  originalTitle: string; originalAmount: number; originalCategory: string; originalNotes: string | null;
  approvals: EditApproval[];
}

export default function FinancePage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balance, setBalance] = useState<Balance[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"expenses" | "balance" | "approvals">("balance");
  const [form, setForm] = useState({
    title: "", amount: "", category: "GENERAL", splitMethod: "EQUAL",
    isRecurring: false, frequency: "MONTHLY", date: "", notes: "", receiptUrl: "",
  });
  const [adding, setAdding] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", amount: "", category: "", notes: "" });
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [requestingEdit, setRequestingEdit] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({ title: "", amount: "", category: "", notes: "" });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<string | null>(null);
  const [confirmingCash, setConfirmingCash] = useState<string | null>(null); // expenseId:userId

  async function load() {
    const [expRes, balRes, aptRes, meRes, erRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/expenses`),
      apiFetch(`/api/apartments/${apartmentId}/balance`),
      apiFetch(`/api/apartments/${apartmentId}`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${apartmentId}/edit-requests`),
    ]);
    if (expRes.status === 401) { router.replace("/login"); return; }
    setExpenses(await expRes.json());
    const balData = await balRes.json();
    setBalance(balData.myBalance ?? []);
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { user: { id: string; name: string } }) => m.user));
    const me = await meRes.json();
    setCurrentUserId(me.id);
    if (erRes.ok) setEditRequests(await erRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch(`/api/apartments/${apartmentId}/expenses/upload-receipt`, { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setForm(f => ({ ...f, receiptUrl: url }));
    }
    setUploadingReceipt(false);
    e.target.value = "";
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    await apiFetch(`/api/apartments/${apartmentId}/expenses`, {
      method: "POST",
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setForm({ title: "", amount: "", category: "GENERAL", splitMethod: "EQUAL", isRecurring: false, frequency: "MONTHLY", date: "", notes: "", receiptUrl: "" });
    setShowAdd(false);
    setAdding(false);
    load();
  }

  async function settle(expenseId: string, method: string) {
    setSettling(expenseId);
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}/settle`, {
      method: "POST", body: JSON.stringify({ method }),
    });
    setSettling(null);
    load();
  }

  async function dispute(expenseId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}`, {
      method: "PATCH", body: JSON.stringify({ status: "DISPUTED" }),
    });
    load();
  }

  async function renewRecurring() {
    setRenewing(true);
    const res = await apiFetch(`/api/apartments/${apartmentId}/expenses/renew-recurring`, { method: "POST" });
    const data = await res.json();
    setRenewing(false);
    if (data.count > 0) { alert(`Created ${data.count} recurring expense${data.count > 1 ? "s" : ""} for this month.`); load(); }
    else { alert("No new recurring expenses to create this month."); }
  }

  async function saveEdit(expenseId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: editForm.title,
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        notes: editForm.notes || null,
      }),
    });
    setEditingExpense(null);
    load();
  }

  async function submitEditRequest(expenseId: string) {
    setSubmittingRequest(true);
    const body: Record<string, unknown> = {};
    if (requestForm.title.trim()) body.title = requestForm.title.trim();
    if (requestForm.amount && parseFloat(requestForm.amount) > 0) body.amount = parseFloat(requestForm.amount);
    if (requestForm.category) body.category = requestForm.category;
    if (requestForm.notes !== undefined) body.notes = requestForm.notes || null;
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}/edit-request`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setRequestingEdit(null);
    setSubmittingRequest(false);
    load();
  }

  async function approveRequest(requestId: string) {
    setApprovingRequest(requestId);
    await apiFetch(`/api/apartments/${apartmentId}/edit-requests/${requestId}`, { method: "POST" });
    setApprovingRequest(null);
    load();
  }

  async function confirmCash(expenseId: string, userId: string, action: "confirm" | "deny") {
    const key = `${expenseId}:${userId}`;
    setConfirmingCash(key);
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}/confirm-cash`, {
      method: "POST",
      body: JSON.stringify({ userId, action }),
    });
    setConfirmingCash(null);
    load();
  }

  async function deleteExpense(expenseId: string) {
    if (!confirm("Delete this expense?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/expenses/${expenseId}`, { method: "DELETE" });
    load();
  }

  function exportCSV() {
    const rows = [
      ["Date", "Title", "Category", "Amount", "Paid By", "My Share", "My Status"],
      ...expenses.map(e => {
        const myShare = e.splits.find(s => s.userId === currentUserId);
        return [
          new Date(e.date).toLocaleDateString(),
          e.title,
          e.category,
          e.amount.toFixed(2),
          e.paidBy.name,
          myShare ? myShare.amount.toFixed(2) : "0.00",
          myShare ? myShare.status : "N/A",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const myOwed = balance.filter(b => b.direction === "you_owe").reduce((s, b) => s + b.amount, 0);
  const owedToMe = balance.filter(b => b.direction === "owed_to_you").reduce((s, b) => s + b.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Finance</span>
          <Link href={`/apartment/${apartmentId}/analytics`}
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            Analytics →
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          {expenses.some(e => e.isRecurring) && (
            <button onClick={renewRecurring} disabled={renewing}
              className="text-sm border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50">
              {renewing ? "…" : "Renew recurring"}
            </button>
          )}
          {expenses.length > 0 && (
            <div className="flex gap-2">
              <button onClick={exportCSV} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                CSV
              </button>
              <button onClick={async () => {
                const { generateExpensePDF } = await import("@/lib/pdf");
                const apt = await apiFetch(`/api/apartments/${apartmentId}`).then(r => r.json());
                generateExpensePDF({
                  apartmentName: apt.name,
                  period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
                  expenses: expenses.map((e: {title:string;amount:number;category:string;paidBy:{name:string};date:string;splits:{userId:string;amount:number}[]}) => ({
                    title: e.title,
                    amount: e.amount,
                    category: e.category,
                    paidBy: e.paidBy.name,
                    date: e.date,
                    myShare: e.splits?.find((s:{userId:string}) => s.userId === currentUserId)?.amount ?? 0,
                  })),
                  totalAmount: expenses.reduce((s: number, e: {amount:number}) => s + e.amount, 0),
                  myTotal: expenses.reduce((s: number, e: {splits:{userId:string;amount:number}[]}) =>
                    s + (e.splits?.find((sp:{userId:string}) => sp.userId === currentUserId)?.amount ?? 0), 0),
                });
              }} className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                PDF
              </button>
            </div>
          )}
          <button onClick={() => setShowAdd(s => !s)} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            + Add expense
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Balance summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <p className="text-xs text-green-600 font-medium mb-1">Owed to you</p>
            <p className="text-2xl font-bold text-green-700">${owedToMe.toFixed(2)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <p className="text-xs text-red-600 font-medium mb-1">You owe</p>
            <p className="text-2xl font-bold text-red-700">${myOwed.toFixed(2)}</p>
          </div>
        </div>

        {/* Rent link */}
        <Link href={`/apartment/${apartmentId}/rent`}
          className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors">
          <div>
            <p className="font-semibold text-gray-900">Rent</p>
            <p className="text-xs text-gray-400 mt-0.5">Track monthly rent payments</p>
          </div>
          <span className="text-gray-300">→</span>
        </Link>

        {/* Add expense form */}
        {showAdd && (
          <form onSubmit={addExpense} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">New expense</h3>
            <input type="text" required placeholder="What was it for?" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount ($)</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Split</label>
                <select value={form.splitMethod} onChange={e => setForm(f => ({ ...f, splitMethod: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="EQUAL">Equal split</option>
                  <option value="PER_PERSON">Per person</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <textarea placeholder="Notes (optional)" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-center">
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={handleReceiptUpload} disabled={uploadingReceipt} />
                {uploadingReceipt ? "Uploading…" : form.receiptUrl ? "Receipt attached ✓" : "Attach receipt (optional)"}
              </label>
              {form.receiptUrl && (
                <button type="button" onClick={() => setForm(f => ({ ...f, receiptUrl: "" }))}
                  className="text-xs text-red-400 hover:text-red-600">Remove</button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
              Recurring expense
              {form.isRecurring && (
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              )}
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={adding} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {adding ? "Adding…" : "Add expense"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["balance", "expenses", "approvals"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors relative ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
              {t === "approvals" && editRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {editRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Balance tab */}
        {tab === "balance" && (
          <div className="space-y-3">
            {balance.length === 0 && <p className="text-sm text-gray-400 text-center py-6">All settled up!</p>}
            {balance.map((b, i) => (
              <div key={i} className={`bg-white border rounded-xl px-5 py-4 ${b.direction === "you_owe" ? "border-red-200" : "border-green-200"}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-900">
                    {b.direction === "you_owe" ? `You owe ${b.toName}` : `${b.fromName} owes you`}
                  </p>
                  <p className={`text-lg font-bold ${b.direction === "you_owe" ? "text-red-600" : "text-green-600"}`}>
                    ${b.amount.toFixed(2)}
                  </p>
                </div>
                {b.direction === "you_owe" && (
                  <div className="flex gap-2 flex-wrap">
                    {METHODS.map(method => {
                      const link = PAYMENT_LINKS[method]?.(b.toName, b.amount);
                      return link ? (
                        <a key={method} href={link} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg font-medium hover:bg-indigo-100 transition-colors">
                          Pay via {method}
                        </a>
                      ) : (
                        <span key={method} className="text-xs text-gray-400 px-3 py-1">{method}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Approvals tab */}
        {tab === "approvals" && (
          <div className="space-y-3">
            {editRequests.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No pending edit requests.</p>}
            {editRequests.map(req => {
              const alreadyApproved = req.approvals.some(a => a.approver.id === currentUserId);
              const isRequester = req.requesterId === currentUserId;
              return (
                <div key={req.id} className="bg-white border border-amber-200 rounded-xl px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{req.requester.name} wants to edit an expense</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {req.approvals.length}/{req.requiredApprovals} approved
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 font-medium mb-1">Original</p>
                      <p className="text-gray-700">{req.originalTitle}</p>
                      <p className="text-gray-500">${req.originalAmount.toFixed(2)} · {req.originalCategory}</p>
                      {req.originalNotes && <p className="text-gray-400 italic">{req.originalNotes}</p>}
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2.5">
                      <p className="text-indigo-500 font-medium mb-1">Proposed</p>
                      <p className="text-gray-700">{req.proposedTitle ?? req.originalTitle}</p>
                      <p className="text-gray-500">${(req.proposedAmount ?? req.originalAmount).toFixed(2)} · {req.proposedCategory ?? req.originalCategory}</p>
                      {(req.proposedNotes !== null && req.proposedNotes !== undefined ? req.proposedNotes : req.originalNotes) && (
                        <p className="text-gray-400 italic">{req.proposedNotes !== null && req.proposedNotes !== undefined ? req.proposedNotes : req.originalNotes}</p>
                      )}
                    </div>
                  </div>

                  {req.approvals.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Approved by: {req.approvals.map(a => a.approver.name).join(", ")}
                    </p>
                  )}

                  {!isRequester && !alreadyApproved && (
                    <button onClick={() => approveRequest(req.id)} disabled={approvingRequest === req.id}
                      className="w-full text-sm bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {approvingRequest === req.id ? "Approving…" : "Approve edit"}
                    </button>
                  )}
                  {alreadyApproved && (
                    <p className="text-xs text-green-600 font-medium text-center">You approved this ✓</p>
                  )}
                  {isRequester && (
                    <p className="text-xs text-gray-400 text-center">Waiting for roommates to approve</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Expenses tab */}
        {tab === "expenses" && (
          <div className="space-y-3">
            {expenses.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No expenses yet.</p>}
            {expenses.map(exp => {
              const mySplit = exp.splits.find(s => s.userId === currentUserId);
              const isPayer = exp.paidBy.id === currentUserId;
              const isEditing = editingExpense === exp.id;
              const isRequestingEdit = requestingEdit === exp.id;
              const ageMs = Date.now() - new Date(exp.createdAt).getTime();
              const isLocked = ageMs > 24 * 60 * 60 * 1000;
              const pendingRequest = editRequests.find(r => r.expenseId === exp.id);
              return (
                <div key={exp.id} className={`bg-white border rounded-xl px-5 py-4 ${exp.status === "DISPUTED" ? "border-orange-300" : "border-gray-200"}`}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" min="0.01" step="0.01" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input type="text" placeholder="Notes (optional)" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(exp.id)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Save</button>
                        <button onClick={() => setEditingExpense(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                      </div>
                    </div>
                  ) : isRequestingEdit ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">Request edit — propose changes</p>
                      <input type="text" placeholder={`Title (current: ${exp.title})`} value={requestForm.title}
                        onChange={e => setRequestForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" min="0.01" step="0.01" placeholder={`Amount (${exp.amount.toFixed(2)})`}
                          value={requestForm.amount} onChange={e => setRequestForm(f => ({ ...f, amount: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <select value={requestForm.category || exp.category}
                          onChange={e => setRequestForm(f => ({ ...f, category: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input type="text" placeholder="Notes (optional)" value={requestForm.notes}
                        onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex gap-2">
                        <button onClick={() => submitEditRequest(exp.id)} disabled={submittingRequest}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                          {submittingRequest ? "Submitting…" : "Submit request"}
                        </button>
                        <button onClick={() => setRequestingEdit(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{exp.title}</p>
                            {exp.receiptUrl && (
                              <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer"
                                title="View receipt"
                                className="text-lg leading-none hover:opacity-70 transition-opacity">
                                🧾
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" · "}{exp.category} · Paid by {exp.paidBy.name} · ${exp.amount.toFixed(2)}
                            {exp.isRecurring && " · Recurring"}
                          </p>
                          {exp.notes && <p className="text-xs text-gray-500 mt-1 italic">{exp.notes}</p>}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          exp.status === "SETTLED" ? "bg-green-100 text-green-700" :
                          exp.status === "DISPUTED" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"}`}>
                          {exp.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-3 space-y-1">
                        {exp.splits.map(s => (
                          <div key={s.userId} className="flex justify-between">
                            <span>{s.user.name}</span>
                            <span className={
                              s.status === "PAID" ? "text-green-600" :
                              s.status === "PENDING_CASH" ? "text-amber-500" :
                              "text-gray-400"}>
                              ${s.amount.toFixed(2)}{" "}
                              {s.status === "PAID" ? "✓" : s.status === "PENDING_CASH" ? "💵 pending" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        {mySplit && mySplit.status === "PENDING" && exp.status !== "DISPUTED" && (
                          <>
                            {["VENMO", "PAYPAL", "CASHAPP"].map(method => {
                              const link = PAYMENT_LINKS[method]?.(exp.paidBy.name, mySplit.amount);
                              return link ? (
                                <a key={method} href={link} target="_blank" rel="noopener noreferrer"
                                  className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg font-medium hover:bg-green-100 transition-colors">
                                  Pay via {method}
                                </a>
                              ) : null;
                            })}
                            <button onClick={() => settle(exp.id, "BANK")}
                              disabled={settling === exp.id}
                              className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg font-medium hover:bg-green-100 disabled:opacity-50 transition-colors">
                              {settling === exp.id ? "…" : "Paid via bank"}
                            </button>
                            <button onClick={() => settle(exp.id, "CASH")}
                              disabled={settling === exp.id}
                              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors">
                              {settling === exp.id ? "…" : "Mark paid in cash"}
                            </button>
                            <button onClick={() => dispute(exp.id)}
                              className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-lg font-medium hover:bg-orange-100 transition-colors">
                              Dispute
                            </button>
                          </>
                        )}
                        {mySplit && mySplit.status === "PENDING_CASH" && (
                          <span className="text-xs text-amber-600 font-medium">
                            Waiting for {exp.paidBy.name} to confirm your cash payment
                          </span>
                        )}
                        {isPayer && exp.splits.some(s => s.status === "PENDING_CASH" && s.userId !== currentUserId) && (
                          <div className="w-full space-y-1 mt-1">
                            {exp.splits.filter(s => s.status === "PENDING_CASH" && s.userId !== currentUserId).map(s => {
                              const key = `${exp.id}:${s.userId}`;
                              return (
                                <div key={s.userId} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  <span className="text-xs text-amber-700 flex-1">
                                    {s.user.name} says they paid ${s.amount.toFixed(2)} in cash
                                  </span>
                                  <button onClick={() => confirmCash(exp.id, s.userId, "confirm")}
                                    disabled={confirmingCash === key}
                                    className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                                    {confirmingCash === key ? "…" : "Confirm"}
                                  </button>
                                  <button onClick={() => confirmCash(exp.id, s.userId, "deny")}
                                    disabled={confirmingCash === key}
                                    className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 transition-colors">
                                    Deny
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex-1" />
                        {pendingRequest && (
                          <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Edit pending ({pendingRequest.approvals.length}/{pendingRequest.requiredApprovals})
                          </span>
                        )}
                        {isPayer && exp.status === "ACTIVE" && !pendingRequest && (
                          isLocked ? (
                            <button onClick={() => { setRequestingEdit(exp.id); setRequestForm({ title: exp.title, amount: exp.amount.toString(), category: exp.category, notes: exp.notes ?? "" }); }}
                              className="text-xs text-amber-500 hover:text-amber-700 font-medium">Request edit</button>
                          ) : (
                            <button onClick={() => { setEditingExpense(exp.id); setEditForm({ title: exp.title, amount: exp.amount.toString(), category: exp.category, notes: exp.notes ?? "" }); }}
                              className="text-xs text-indigo-400 hover:text-indigo-600 font-medium">Edit</button>
                          )
                        )}
                        {isPayer && (
                          <button onClick={() => deleteExpense(exp.id)}
                            className="text-xs text-red-400 hover:text-red-600 px-1">Delete</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
