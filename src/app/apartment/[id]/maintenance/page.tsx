"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  landlordNote: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy: { name: string };
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-500",
  MEDIUM: "bg-blue-100 text-blue-600",
  URGENT: "bg-red-100 text-red-600",
};
const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

export default function MaintenancePage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch(`/api/apartments/${apartmentId}/maintenance`);
    if (res.status === 403) { router.replace(`/apartment/${apartmentId}`); return; }
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await apiFetch(`/api/apartments/${apartmentId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to submit"); setSubmitting(false); return; }
    setForm({ title: "", description: "", priority: "MEDIUM" });
    setShowForm(false);
    setSubmitting(false);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Home</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Maintenance</span>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          + New request
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {showForm && (
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Submit a maintenance request</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Title</label>
              <input
                type="text" required value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Leaking faucet in bathroom"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                required rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail…"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(["LOW", "MEDIUM", "URGENT"] as const).map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${form.priority === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                    {p === "LOW" ? "Low" : p === "MEDIUM" ? "Medium" : "Urgent"}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? "Submitting…" : "Submit request"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </form>
        )}

        {requests.length === 0 && !showForm ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🔧</p>
            <p className="text-gray-500 font-medium">No requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Submit a request when something needs fixing.</p>
          </div>
        ) : (
          requests.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{r.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[r.priority]}`}>
                    {r.priority}
                  </span>
                </div>
              </div>
              {r.landlordNote && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-blue-700 mb-0.5">Landlord note</p>
                  <p className="text-sm text-blue-800">{r.landlordNote}</p>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Submitted {new Date(r.createdAt).toLocaleDateString()}
                {r.updatedAt !== r.createdAt && ` · Updated ${new Date(r.updatedAt).toLocaleDateString()}`}
              </p>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
