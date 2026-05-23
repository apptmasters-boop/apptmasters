"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface Apartment { id: string; name: string; inviteCode: string; role: string }
interface User { id: string; name: string; email: string; memberships: { role: string; apartment: Apartment }[] }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me").then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      setUser(data);
      setLoading(false);
    });
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const apartments = user?.memberships ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-indigo-600">ApptMasters</span>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">{user?.name}</Link>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your apartments</h1>

        {apartments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-500 mb-6">You&apos;re not part of any apartment yet.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/apartment/create" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Create apartment
              </Link>
              <Link href="/apartment/join" className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Join with code
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {apartments.map(({ role, apartment }) => (
              <Link key={apartment.id} href={`/apartment/${apartment.id}`}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-indigo-300 transition-colors">
                <div>
                  <p className="font-semibold text-gray-900">{apartment.name}</p>
                  <p className="text-sm text-gray-400 mt-0.5">Code: {apartment.inviteCode} · {role}</p>
                </div>
                <span className="text-gray-300">→</span>
              </Link>
            ))}
            <div className="flex gap-3 pt-2">
              <Link href="/apartment/create" className="text-sm text-indigo-600 font-medium hover:underline">+ Create apartment</Link>
              <Link href="/apartment/join" className="text-sm text-indigo-600 font-medium hover:underline">+ Join with code</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
