"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface DisputeUser { id: string; name: string }
interface Comment { id: string; body: string; createdAt: string; user: DisputeUser }
interface Dispute {
  id: string; title: string; description: string; status: string;
  resolution: string | null; resolvedAt: string | null; createdAt: string;
  raisedBy: DisputeUser; against: DisputeUser | null; comments: Comment[];
}
interface Member { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-gray-100 text-gray-500",
};

export default function DisputesPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", againstId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commenting, setCommenting] = useState<string | null>(null);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{ id: string; action: "RESOLVED" | "DISMISSED" } | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  async function load() {
    const [dRes, meRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/disputes`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (dRes.status === 401) { router.replace("/login"); return; }
    setDisputes(await dRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUserId(me.id);
      if (aptRes.ok) {
        const apt = await aptRes.json();
        setMembers(apt.members.map((m: { user: Member }) => m.user));
        const myM = apt.members.find((m: { user: { id: string }; role: string }) => m.user.id === me.id);
        setIsAdmin(myM?.role === "ADMIN");
      }
    }
    setLoading(false);
  }

  const searchParams = useSearchParams();
  const focusDisputeId = searchParams.get("focus");

  useEffect(() => { load(); }, [apartmentId]);

  useEffect(() => {
    if (focusDisputeId) {
      setExpandedId(focusDisputeId);
    }
  }, [focusDisputeId]);

  useEffect(() => {
    if (!focusDisputeId) return;
    const disputeEl = document.getElementById(`dispute-${focusDisputeId}`);
    if (disputeEl) disputeEl.scrollIntoView({ behavior: "smooth", block: "start" });

    const hash = window.location.hash;
    if (hash.startsWith("#comment-")) {
      const commentId = hash.replace("#comment-", "");
      setFocusedCommentId(commentId);
      const commentEl = document.querySelector(hash) as HTMLElement | null;
      if (commentEl) commentEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [expandedId, focusDisputeId]);

  useEffect(() => {
    if (!focusedCommentId) return;
    const timer = window.setTimeout(() => setFocusedCommentId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [focusedCommentId]);

  async function createDispute(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await apiFetch(`/api/apartments/${apartmentId}/disputes`, {
      method: "POST",
      body: JSON.stringify({ title: form.title, description: form.description, againstId: form.againstId || undefined }),
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ title: "", description: "", againstId: "" });
    load();
  }

  async function addComment(disputeId: string) {
    const body = commentText[disputeId]?.trim();
    if (!body) return;
    setCommenting(disputeId);
    await apiFetch(`/api/apartments/${apartmentId}/disputes/${disputeId}/comment`, {
      method: "POST", body: JSON.stringify({ body }),
    });
    setCommenting(null);
    setCommentText(t => ({ ...t, [disputeId]: "" }));
    load();
  }

  async function resolveDispute() {
    if (!resolveModal) return;
    setResolving(true);
    await apiFetch(`/api/apartments/${apartmentId}/disputes/${resolveModal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: resolveModal.action, resolution }),
    });
    setResolving(false);
    setResolveModal(null);
    setResolution("");
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Disputes</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell apartmentId={apartmentId} />
          <button onClick={() => setShowForm(v => !v)}
            className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-600 transition-colors">
            {showForm ? "Cancel" : "Raise dispute"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* New dispute form */}
        {showForm && (
          <form onSubmit={createDispute} className="bg-white border border-red-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Raise a dispute</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <input required type="text" placeholder="Brief summary of the issue" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <textarea required rows={3} placeholder="Describe the situation in detail…" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Against (optional)</label>
              <select value={form.againstId} onChange={e => setForm(f => ({ ...f, againstId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                <option value="">No specific person</option>
                {members.filter(m => m.id !== currentUserId).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
              {submitting ? "Submitting…" : "Submit dispute"}
            </button>
          </form>
        )}

        {disputes.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400">No disputes yet. Hopefully it stays that way!</p>
          </div>
        )}

        {disputes.map(d => {
          const isExpanded = expandedId === d.id;
          return (
            <div id={`dispute-${d.id}`} key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{d.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Raised by {d.raisedBy.name}{d.against ? ` · Against ${d.against.name}` : ""}
                      {" · "}{new Date(d.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{d.description}</p>
                    {d.resolution && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-700">Resolution</p>
                        <p className="text-sm text-emerald-800 mt-0.5">{d.resolution}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    className="text-xs text-indigo-500 hover:underline whitespace-nowrap">
                    {isExpanded ? "Hide" : `Comments (${d.comments.length})`}
                  </button>
                </div>

                {/* Admin actions */}
                {isAdmin && d.status === "OPEN" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => setResolveModal({ id: d.id, action: "RESOLVED" })}
                      className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Resolve
                    </button>
                    <button onClick={() => setResolveModal({ id: d.id, action: "DISMISSED" })}
                      className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Comments */}
              {isExpanded && (
                <div className="border-t border-gray-50">
                  {d.comments.length > 0 && (
                    <div className="px-5 py-3 space-y-2">
                      {d.comments.map(c => {
                        const isFocusedComment = focusedCommentId === c.id;
                        return (
                          <div id={`comment-${c.id}`} key={c.id} className={`flex gap-2 ${c.user.id === currentUserId ? "flex-row-reverse" : ""} ${isFocusedComment ? "ring-2 ring-indigo-500/60 bg-indigo-50 rounded-3xl" : ""}`}>
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                              {c.user.name.charAt(0)}
                            </div>
                            <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${c.user.id === currentUserId ? "bg-indigo-100 text-indigo-900" : "bg-gray-100 text-gray-900"}`}>
                              <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{c.user.name}</p>
                              {c.body}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {d.status === "OPEN" && (
                    <div className="px-5 pb-4 flex gap-2">
                      <input type="text" placeholder="Add a comment…" value={commentText[d.id] ?? ""}
                        onChange={e => setCommentText(t => ({ ...t, [d.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") addComment(d.id); }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      <button onClick={() => addComment(d.id)} disabled={commenting === d.id}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {commenting === d.id ? "…" : "Send"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Resolve modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{resolveModal.action === "RESOLVED" ? "Resolve dispute" : "Dismiss dispute"}</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Resolution note (optional)</label>
              <textarea rows={3} placeholder="Describe what was decided…" value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={resolveDispute} disabled={resolving}
                className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors ${resolveModal.action === "RESOLVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700"}`}>
                {resolving ? "Saving…" : resolveModal.action === "RESOLVED" ? "Mark resolved" : "Dismiss"}
              </button>
              <button onClick={() => { setResolveModal(null); setResolution(""); }}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
