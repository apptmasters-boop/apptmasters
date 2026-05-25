"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [role, setRole] = useState<"MEMBER" | "GUEST">("MEMBER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRules, setPendingRules] = useState<{ id: string; content: string }[] | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    const c = searchParams.get("code");
    if (c) setCode(c.toUpperCase());
  }, [searchParams]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/apartments/join", {
      method: "POST", body: JSON.stringify({ inviteCode: code.toUpperCase(), role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Failed to join");
    setApartmentId(data.member.apartmentId);
    if (data.pendingRules?.length > 0) {
      setPendingRules(data.pendingRules);
    } else {
      router.push(`/apartment/${data.member.apartmentId}`);
    }
  }

  async function handleAcknowledge() {
    if (!apartmentId || !pendingRules) return;
    setAcknowledging(true);
    for (const rule of pendingRules) {
      await apiFetch(`/api/apartments/${apartmentId}/rules/${rule.id}/acknowledge`, { method: "POST" });
    }
    setAcknowledging(false);
    router.push(`/apartment/${apartmentId}`);
  }

  if (pendingRules) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-2">House rules</h1>
          <p className="text-sm text-gray-500 mb-5">You must acknowledge the house rules before joining.</p>
          <div className="space-y-3 mb-6">
            {pendingRules.map((rule, i) => (
              <div key={rule.id} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
                <span className="font-medium text-gray-400 mr-2">{i + 1}.</span>{rule.content}
              </div>
            ))}
          </div>
          <button
            onClick={handleAcknowledge} disabled={acknowledging}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {acknowledging ? "Saving…" : "I agree to these rules"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Join apartment</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the 6-digit code your roommate shared with you.</p>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
            <input
              type="text" required maxLength={6} placeholder="ABC123"
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Joining as</label>
            <div className="flex gap-3">
              {(["MEMBER", "GUEST"] as const).map(r => (
                <button key={r} type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${role === r ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {r === "MEMBER" ? "Roommate" : "Guest"}
                </button>
              ))}
            </div>
            {role === "GUEST" && <p className="text-xs text-gray-400 mt-1">Guests have read-only access — no messaging or calls.</p>}
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Joining…" : "Join apartment"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinApartmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <JoinForm />
    </Suspense>
  );
}
