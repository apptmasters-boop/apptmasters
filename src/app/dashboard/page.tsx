"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";

interface Apartment { id: string; name: string; inviteCode: string; role: string }
interface User { id: string; name: string; email: string; memberships: { role: string; apartment: Apartment }[] }
interface AptStats {
  pendingGrocery: number;
  lowInventory: number;
  activeDisputes: number;
  pendingRent: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, AptStats>>({});

  useEffect(() => {
    apiFetch("/api/auth/me").then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      setUser(data);
      setLoading(false);

      // Load quick stats for each apartment in parallel
      const apts: Apartment[] = data.memberships.map((m: { apartment: Apartment }) => m.apartment);
      await Promise.all(apts.map(async apt => {
        try {
          const [grocRes, invRes, dispRes] = await Promise.all([
            apiFetch(`/api/apartments/${apt.id}/grocery`),
            apiFetch(`/api/apartments/${apt.id}/inventory`),
            apiFetch(`/api/apartments/${apt.id}/disputes`),
          ]);
          const grocery = grocRes.ok ? await grocRes.json() : [];
          const inventory = invRes.ok ? await invRes.json() : [];
          const disputes = dispRes.ok ? await dispRes.json() : [];
          setStats(prev => ({
            ...prev,
            [apt.id]: {
              pendingGrocery: grocery.filter((g: { purchased: boolean }) => !g.purchased).length,
              lowInventory: inventory.filter((i: { quantity: number; reorderThreshold: number }) => i.quantity <= i.reorderThreshold).length,
              activeDisputes: disputes.filter((d: { status: string }) => d.status === "OPEN").length,
              pendingRent: false,
            },
          }));
        } catch { /* stats are optional */ }
      }));
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
          <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900 font-medium">{user?.name}</Link>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your apartments</h1>
        <p className="text-sm text-gray-400 mb-6">{user?.email}</p>

        {apartments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-4xl mb-4">🏠</p>
            <p className="text-gray-600 font-medium mb-1">No apartments yet</p>
            <p className="text-sm text-gray-400 mb-6">Create or join an apartment to get started.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/apartment/create"
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Create apartment
              </Link>
              <Link href="/apartment/join"
                className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Join with code
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {apartments.map(({ role, apartment }) => {
              const s = stats[apartment.id];
              const alerts = s
                ? [
                    s.pendingGrocery > 0 && `${s.pendingGrocery} grocery`,
                    s.lowInventory > 0 && `${s.lowInventory} low stock`,
                    s.activeDisputes > 0 && `${s.activeDisputes} dispute${s.activeDisputes > 1 ? "s" : ""}`,
                  ].filter(Boolean)
                : [];

              return (
                <Link key={apartment.id} href={`/apartment/${apartment.id}`}
                  className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{apartment.name}</p>
                      <p className="text-sm text-gray-400 mt-0.5">Code: {apartment.inviteCode} · {role}</p>
                    </div>
                    <span className="text-gray-300 text-lg">→</span>
                  </div>
                  {alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {alerts.map(a => (
                        <span key={String(a)} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}

            <div className="flex gap-4 pt-2">
              <Link href="/apartment/create" className="text-sm text-indigo-600 font-medium hover:underline">+ Create apartment</Link>
              <Link href="/apartment/join" className="text-sm text-indigo-600 font-medium hover:underline">+ Join with code</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
