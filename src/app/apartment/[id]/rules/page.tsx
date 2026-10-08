"use client";
/**
 * Household → House rules: the household's rules, and proposals being voted on.
 * Members propose a rule (it goes to a 48-hour vote); household admins can add
 * one directly or put it to a vote, and archive rules. Guests can read only.
 */
import { useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BackLink } from "@/components/home/HomeNav";
import { useApartment, pageClass } from "@/components/home/useApartment";

export default function HouseRulesPage() {
  const { id } = useParams<{ id: string }>();
  const { apt, failed, reload, isAdmin, isGuest } = useApartment(id);
  const [newRule, setNewRule] = useState("");
  const [putToVote, setPutToVote] = useState(false);
  const [saving, setSaving] = useState(false);

  if (failed) return <p className="p-8 text-center text-sm text-gray-500">Couldn&apos;t load house rules. Please refresh.</p>;
  if (!apt) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Non-admins always propose; admins choose (the server enforces the same rule)
    await apiFetch(`/api/apartments/${id}/rules`, { method: "POST", body: JSON.stringify({ content: newRule, propose: !isAdmin || putToVote }) });
    setNewRule("");
    setSaving(false);
    reload();
  }
  async function vote(ruleId: string, choice: "YES" | "NO") {
    await apiFetch(`/api/apartments/${id}/rules/${ruleId}/vote`, { method: "POST", body: JSON.stringify({ vote: choice }) });
    reload();
  }
  async function archive(ruleId: string) {
    if (!confirm("Archive this rule? It will no longer be shown.")) return;
    await apiFetch(`/api/apartments/${id}/rules/${ruleId}/archive`, { method: "POST" });
    reload();
  }

  const proposed = apt.houseRules.filter(r => r.status === "PROPOSED");
  const active = apt.houseRules.filter(r => r.status !== "PROPOSED");

  return (
    <main className={pageClass}>
      <BackLink />
      <h1 className="mt-3 text-2xl font-bold text-gray-900">House rules</h1>
      <p className="mt-1 text-sm text-gray-500">What everyone in {apt.name} has agreed to.</p>

      {proposed.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Being voted on</h2>
          <ul className="space-y-2.5">
            {proposed.map(rule => {
              const mine = rule.votes.find(v => v.user.id === apt.currentUserId)?.vote;
              const yes = rule.votes.filter(v => v.vote === "YES").length;
              const no = rule.votes.filter(v => v.vote === "NO").length;
              return (
                <li key={rule.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3.5 dark:bg-amber-950/20">
                  <p className="text-sm text-gray-900">{rule.content}</p>
                  {rule.votingEndsAt && <p className="mt-1 text-xs text-gray-500">Voting ends {new Date(rule.votingEndsAt).toLocaleDateString()}</p>}
                  {!isGuest && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => vote(rule.id, "YES")} aria-pressed={mine === "YES"}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${mine === "YES" ? "border-brand bg-brand text-white" : "border-gray-300 bg-white text-gray-700"}`}>
                        Yes ({yes})
                      </button>
                      <button onClick={() => vote(rule.id, "NO")} aria-pressed={mine === "NO"}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${mine === "NO" ? "border-red-500 bg-red-500 text-white" : "border-gray-300 bg-white text-gray-700"}`}>
                        No ({no})
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Our rules</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No house rules yet.</p>
        ) : (
          <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {active.map((rule, i) => (
              <li key={rule.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 text-sm font-semibold text-gray-400">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-800">{rule.content}</span>
                {isAdmin && <button onClick={() => archive(rule.id)} className="text-xs text-gray-400 hover:text-red-600">Archive</button>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!isGuest && (
        <form onSubmit={addRule} className="mt-6 space-y-2">
          <div className="flex gap-2">
            <input type="text" required value={newRule} onChange={e => setNewRule(e.target.value)}
              placeholder={isAdmin ? "Add a house rule…" : "Propose a rule…"}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
            <button type="submit" disabled={saving} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              {saving ? "…" : isAdmin && !putToVote ? "Add" : "Propose"}
            </button>
          </div>
          {isAdmin ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={putToVote} onChange={e => setPutToVote(e.target.checked)} className="accent-brand" />
              Put it to a 48-hour vote instead of adding it directly
            </label>
          ) : (
            <p className="text-xs text-gray-500">Your proposal goes to a 48-hour household vote.</p>
          )}
        </form>
      )}
    </main>
  );
}
