"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function CreateApartmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/apartments", { method: "POST", body: JSON.stringify({ name }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Failed to create apartment");
    router.push(`/apartment/${data.id}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create apartment</h1>
        <p className="text-sm text-gray-500 mb-6">Give your place a name your roommates will recognize.</p>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apartment name</label>
            <input
              type="text" required placeholder="e.g. The Loft, Casa Verde…"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : "Create apartment"}
          </button>
        </form>
      </div>
    </div>
  );
}
