"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearToken } from "@/lib/api";
import IconBadge from "@/components/IconBadge";
import {
  UsersIcon, HouseIcon, ChatIcon, FinanceIcon, AnnouncementIcon,
  RoomsIcon, AdminIcon, ChevronRightIcon,
} from "@/components/icons";

interface Apartment { id: string; name: string; inviteCode: string; role: string }
interface User { id: string; name: string; email: string; photo: string | null; systemRole: string; memberships: { role: string; apartment: Apartment }[] }
interface AptStats {
  pendingGrocery: number;
  lowInventory: number;
  activeDisputes: number;
  overdueChores: number;
  myChoresCount: number;
}
interface AdminStats { totalUsers: number; totalApartments: number; totalMessages: number; totalExpenses: number }
interface Building { id: string; name: string; address: string; _count: { units: number } }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, AptStats>>({});
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [pendingListings, setPendingListings] = useState(0);
  const [buildings, setBuildings] = useState<Building[] | null>(null);

  useEffect(() => {
    apiFetch("/api/auth/me").then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      setUser(data);
      setLoading(false);

      if (data.systemRole === "SUPER_ADMIN") {
        const [statsRes, pendingRes] = await Promise.all([
          apiFetch("/api/admin/stats"),
          apiFetch("/api/admin/listings"),
        ]);
        if (statsRes.ok) setAdminStats(await statsRes.json());
        if (pendingRes.ok) setPendingListings((await pendingRes.json()).length);
        return;
      }

      if (data.systemRole === "MANAGER") {
        const res2 = await apiFetch("/api/manager/buildings");
        if (res2.ok) setBuildings(await res2.json());
        return;
      }

      // Tenant — load quick stats for each apartment in parallel
      const userId = data.id;
      const memberships: { role: string; apartment: Apartment }[] = data.memberships ?? [];
      const apts: Apartment[] = memberships.map(m => m.apartment);
      await Promise.all(apts.map(async apt => {
        try {
          const [grocRes, invRes, dispRes, choresRes] = await Promise.all([
            apiFetch(`/api/apartments/${apt.id}/grocery`),
            apiFetch(`/api/apartments/${apt.id}/inventory`),
            apiFetch(`/api/apartments/${apt.id}/disputes`),
            apiFetch(`/api/apartments/${apt.id}/chores`),
          ]);
          const grocery = grocRes.ok ? await grocRes.json() : [];
          const inventory = invRes.ok ? await invRes.json() : [];
          const disputes = dispRes.ok ? await dispRes.json() : [];
          const chores = choresRes.ok ? await choresRes.json() : [];
          const now = new Date();
          setStats(prev => ({
            ...prev,
            [apt.id]: {
              pendingGrocery: grocery.filter((g: { purchased: boolean }) => !g.purchased).length,
              lowInventory: inventory.filter((i: { quantity: number; reorderThreshold: number }) => i.quantity <= i.reorderThreshold).length,
              activeDisputes: disputes.filter((d: { status: string }) => d.status === "OPEN").length,
              overdueChores: chores.filter((c: { status: string; dueDate: string | null }) =>
                c.status === "PENDING" && c.dueDate && new Date(c.dueDate) < now
              ).length,
              myChoresCount: chores.filter((c: { assignedTo: { id: string } | null; status: string }) =>
                c.assignedTo?.id === userId && c.status !== "DONE"
              ).length,
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
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-blue-600">ApptMasters</span>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {user?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photo} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                {user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <span className="text-sm text-gray-600 font-medium">{user?.name}</span>
          </Link>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{greeting()}, {firstName || "there"} 👋</h1>
        <p className="text-sm text-gray-400 mb-6">{user?.email}</p>

        {user?.systemRole === "SUPER_ADMIN" && (
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatTile icon={<UsersIcon />} color="indigo" label="Total Users" value={adminStats?.totalUsers ?? "—"} />
              <StatTile icon={<HouseIcon />} color="rose" label="Apartments" value={adminStats?.totalApartments ?? "—"} />
              <StatTile icon={<ChatIcon />} color="emerald" label="Messages" value={adminStats?.totalMessages ?? "—"} />
              <StatTile icon={<FinanceIcon />} color="blue" label="Expenses Logged" value={adminStats?.totalExpenses ?? "—"} />
              <StatTile icon={<AnnouncementIcon />} color="amber" label="Pending Approvals" value={pendingListings} />
            </div>
            <Link href="/admin"
              className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <IconBadge icon={<AdminIcon />} color="slate" size="lg" />
                <div>
                  <p className="font-semibold text-gray-900">Continue to Admin Panel</p>
                  <p className="text-xs text-gray-400">Moderate listings, manage users, review activity</p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-300" />
            </Link>
          </div>
        )}

        {user?.systemRole === "MANAGER" && (
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={<HouseIcon />} color="rose" label="Buildings" value={buildings?.length ?? "—"} />
              <StatTile icon={<RoomsIcon />} color="violet" label="Units" value={buildings ? buildings.reduce((s, b) => s + b._count.units, 0) : "—"} />
            </div>
            <Link href="/manager"
              className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <IconBadge icon={<HouseIcon />} color="blue" size="lg" />
                <div>
                  <p className="font-semibold text-gray-900">Continue to Manager Portal</p>
                  <p className="text-xs text-gray-400">Manage your buildings, units, and tenants</p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-300" />
            </Link>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Looking for a place, or have one to share?</p>
            <p className="text-sm text-gray-500 mt-0.5">Browse or post listings — free, no broker fee.</p>
          </div>
          <Link href="/listings" className="mt-3 inline-flex sm:mt-0 text-sm bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors">
            Browse listings →
          </Link>
        </div>

        {user?.systemRole === "USER" && (
          <>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Your apartments</h2>
            {apartments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <IconBadge icon={<HouseIcon />} color="blue" size="xl" className="mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">No apartments yet</p>
                <p className="text-sm text-gray-400 mb-6">Create or join an apartment to get started.</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/apartment/create"
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
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
                        s.overdueChores > 0 && { label: `${s.overdueChores} overdue`, color: "bg-red-50 text-red-700 border-red-200" },
                        s.myChoresCount > 0 && { label: `${s.myChoresCount} my chore${s.myChoresCount > 1 ? "s" : ""}`, color: "bg-blue-50 text-blue-700 border-blue-200" },
                        s.pendingGrocery > 0 && { label: `${s.pendingGrocery} grocery`, color: "bg-amber-50 text-amber-700 border-amber-200" },
                        s.lowInventory > 0 && { label: `${s.lowInventory} low stock`, color: "bg-amber-50 text-amber-700 border-amber-200" },
                        s.activeDisputes > 0 && { label: `${s.activeDisputes} dispute${s.activeDisputes > 1 ? "s" : ""}`, color: "bg-orange-50 text-orange-700 border-orange-200" },
                      ].filter(Boolean) as { label: string; color: string }[]
                    : [];

                  return (
                    <Link key={apartment.id} href={`/apartment/${apartment.id}`}
                      className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconBadge icon={<HouseIcon />} color="blue" />
                          <div>
                            <p className="font-semibold text-gray-900">{apartment.name}</p>
                            <p className="text-sm text-gray-400 mt-0.5">{role}</p>
                          </div>
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-gray-300" />
                      </div>
                      {alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {alerts.map(a => (
                            <span key={a.label} className={`text-[11px] border px-2 py-0.5 rounded-full font-medium ${a.color}`}>
                              {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {!s && (
                        <p className="text-xs text-gray-300 mt-2">Loading…</p>
                      )}
                    </Link>
                  );
                })}

                <div className="flex gap-4 pt-2">
                  <Link href="/apartment/create" className="text-sm text-blue-600 font-medium hover:underline">+ Create apartment</Link>
                  <Link href="/apartment/join" className="text-sm text-blue-600 font-medium hover:underline">+ Join with code</Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatTile({ icon, color, label, value }: { icon: React.ReactNode; color: Parameters<typeof IconBadge>[0]["color"]; label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3">
      <IconBadge icon={icon} color={color} size="lg" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
