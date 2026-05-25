"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface ScoreEntry {
  userId: string; name: string; score: number | null; tier: string;
  visibility: string; isSelf: boolean;
  logs: { id: string; delta: number; reason: string; createdAt: string }[];
}

const TIER_COLORS: Record<string, string> = {
  Great: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Good: "bg-blue-100 text-blue-700 border-blue-200",
  Fair: "bg-amber-100 text-amber-700 border-amber-200",
  Poor: "bg-red-100 text-red-700 border-red-200",
  Private: "bg-gray-100 text-gray-500 border-gray-200",
};

const SCORE_BAR: Record<string, string> = {
  Great: "bg-emerald-500", Good: "bg-blue-500", Fair: "bg-amber-400", Poor: "bg-red-500", Private: "bg-gray-300",
};

export default function ScoresPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<{ userId: string; delta: string; reason: string } | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [savingVis, setSavingVis] = useState(false);

  async function load() {
    const [scoresRes, meRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/scores`),
      apiFetch("/api/auth/me"),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (scoresRes.status === 401) { router.replace("/login"); return; }
    setScores(await scoresRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUserId(me.id);
      if (aptRes.ok) {
        const apt = await aptRes.json();
        const m = apt.members.find((m: { user: { id: string }; role: string }) => m.user.id === me.id);
        setIsAdmin(m?.role === "ADMIN");
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function saveVisibility(visibility: string) {
    setSavingVis(true);
    await apiFetch(`/api/apartments/${apartmentId}/scores/me`, {
      method: "PATCH", body: JSON.stringify({ visibility }),
    });
    setSavingVis(false);
    load();
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustForm) return;
    setAdjusting(true);
    await apiFetch(`/api/apartments/${apartmentId}/scores/adjust`, {
      method: "POST",
      body: JSON.stringify({ userId: adjustForm.userId, delta: parseInt(adjustForm.delta), reason: adjustForm.reason }),
    });
    setAdjusting(false);
    setAdjustForm(null);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const me = scores.find(s => s.isSelf);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Roommate Scores</span>
        </div>
        <NotificationBell apartmentId={apartmentId} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* My privacy setting */}
        {me && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">My score visibility</p>
            <div className="flex gap-2">
              {(["EXACT", "TIER", "PRIVATE"] as const).map(v => (
                <button key={v} onClick={() => saveVisibility(v)} disabled={savingVis}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${me.visibility === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {v === "EXACT" ? "Show number" : v === "TIER" ? "Show tier" : "Private"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {me.visibility === "EXACT" ? "Everyone sees your exact score." : me.visibility === "TIER" ? "Others see your tier (Great/Good/Fair/Poor), not the number." : "Only you and admins see your score."}
            </p>
          </div>
        )}

        {/* Score cards */}
        <div className="space-y-3">
          {scores.map(entry => {
            const pct = entry.score != null ? Math.min(100, Math.max(0, entry.score)) : null;
            const isExpanded = expandedId === entry.userId;
            return (
              <div key={entry.userId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{entry.name}{entry.isSelf && <span className="text-gray-400"> (you)</span>}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TIER_COLORS[entry.tier] ?? "bg-gray-100 text-gray-500"}`}>
                          {entry.tier}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {entry.score != null && (
                        <span className="text-2xl font-bold text-gray-900">{entry.score}</span>
                      )}
                      <div className="flex gap-1.5">
                        {(entry.isSelf || isAdmin) && entry.logs.length > 0 && (
                          <button onClick={() => setExpandedId(isExpanded ? null : entry.userId)}
                            className="text-xs text-indigo-500 hover:underline">
                            {isExpanded ? "Hide" : "History"}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setAdjustForm({ userId: entry.userId, delta: "5", reason: "" })}
                            className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 px-2 py-0.5 rounded-lg">
                            Adjust
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Score bar */}
                  {pct != null && (
                    <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${SCORE_BAR[entry.tier] ?? "bg-gray-400"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>

                {/* History */}
                {isExpanded && entry.logs.length > 0 && (
                  <div className="border-t border-gray-50 px-5 py-3 space-y-1.5">
                    {entry.logs.map(log => (
                      <div key={log.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{log.reason}</span>
                        <span className={log.delta >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                          {log.delta >= 0 ? "+" : ""}{log.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Admin adjust modal */}
        {adjustForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <form onSubmit={submitAdjust} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Adjust score</h3>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Delta (positive or negative)</label>
                <input type="number" required value={adjustForm.delta}
                  onChange={e => setAdjustForm(f => f ? { ...f, delta: e.target.value } : f)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <input type="text" required placeholder="e.g. Late on dishes three times" value={adjustForm.reason}
                  onChange={e => setAdjustForm(f => f ? { ...f, reason: e.target.value } : f)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={adjusting}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {adjusting ? "Saving…" : "Apply"}
                </button>
                <button type="button" onClick={() => setAdjustForm(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Move-out links */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Move-out reports</p>
          <div className="space-y-1.5">
            {scores.map(entry => (
              (entry.isSelf || isAdmin) && (
                <Link key={entry.userId} href={`/apartment/${apartmentId}/moveout/${entry.userId}`}
                  className="flex items-center justify-between py-1.5 text-sm text-indigo-600 hover:underline">
                  <span>{entry.name}{entry.isSelf ? " (you)" : ""}</span>
                  <span className="text-gray-400 text-xs">View report →</span>
                </Link>
              )
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
