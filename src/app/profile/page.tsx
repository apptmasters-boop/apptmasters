"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher", "Nut allergy", "Dairy-free"];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", roomAssignment: "", moveInDate: "", dietaryFlags: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me").then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      setForm({
        name: data.name ?? "",
        roomAssignment: data.roomAssignment ?? "",
        moveInDate: data.moveInDate ? data.moveInDate.slice(0, 10) : "",
        dietaryFlags: JSON.parse(data.dietaryFlags || "[]"),
      });
      setLoading(false);
    });
  }, [router]);

  function toggleFlag(flag: string) {
    setForm(f => ({
      ...f,
      dietaryFlags: f.dietaryFlags.includes(flag)
        ? f.dietaryFlags.filter(x => x !== flag)
        : [...f.dietaryFlags, flag],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiFetch("/api/users/profile", { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-900">My profile</span>
      </header>

      <main className="max-w-md mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room assignment</label>
            <input
              type="text" placeholder="e.g. Master bedroom, Room 2…"
              value={form.roomAssignment}
              onChange={e => setForm(f => ({ ...f, roomAssignment: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Move-in date</label>
            <input
              type="date" value={form.moveInDate}
              onChange={e => setForm(f => ({ ...f, moveInDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary flags</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map(flag => (
                <button key={flag} type="button" onClick={() => toggleFlag(flag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.dietaryFlags.includes(flag) ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {flag}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>
    </div>
  );
}
