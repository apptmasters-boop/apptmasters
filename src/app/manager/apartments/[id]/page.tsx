"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Member {
  id: string; role: string; status: string; joinedAt: string;
  user: { id: string; name: string; email: string; photo: string | null };
}
interface Apartment {
  id: string; name: string; inviteCode: string;
  members: Member[];
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-blue-100 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-600",
  GUEST: "bg-amber-100 text-amber-700",
};

export default function ManagerApartmentPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [apt, setApt] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"ADMIN" | "MEMBER" | "GUEST">("MEMBER");
  const [adding, setAdding] = useState(false);
  const [tempCreds, setTempCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await apiFetch(`/api/manager/apartments/${apartmentId}`);
    if (res.status === 403) { router.replace("/manager"); return; }
    if (res.status === 404) { router.replace("/manager"); return; }
    if (res.ok) setApt(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    const res = await apiFetch(`/api/manager/apartments/${apartmentId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddEmail("");
      if (data.tempPassword) {
        setTempCreds({ email: data.member.user.email, password: data.tempPassword });
      }
      load();
    } else {
      alert(data.error ?? "Could not add member.");
    }
    setAdding(false);
  }

  async function setRole(memberId: string, role: string) {
    setWorking(memberId);
    await apiFetch(`/api/manager/apartments/${apartmentId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    setWorking(null);
    load();
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this apartment?`)) return;
    setWorking(memberId);
    await apiFetch(`/api/manager/apartments/${apartmentId}/members/${memberId}`, { method: "DELETE" });
    setWorking(null);
    load();
  }

  async function deleteAccount(userId: string, name: string) {
    if (!confirm(`Permanently delete the account for "${name}"? This cannot be undone.`)) return;
    setWorking(userId);
    const res = await apiFetch(`/api/manager/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not delete account.");
    }
    setWorking(null);
    load();
  }

  async function deleteApartment() {
    if (!confirm(`Delete apartment "${apt?.name}"? All data will be permanently removed.`)) return;
    await apiFetch(`/api/manager/apartments/${apartmentId}`, { method: "DELETE" });
    router.replace("/manager");
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/apartment/join?code=${apt!.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!apt) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/manager" className="text-sm text-gray-400 hover:text-gray-600">← Manager Panel</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{apt.name}</span>
        </div>
        <button onClick={deleteApartment}
          className="text-sm text-red-400 hover:text-red-600 transition-colors">Delete apartment</button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Invite code */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Invite code</p>
            <p className="font-mono font-semibold text-gray-900 text-lg">{apt.inviteCode}</p>
          </div>
          <button onClick={copyInviteLink}
            className="text-sm text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>

        {/* Temp credentials modal */}
        {tempCreds && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800">New account created — share these credentials with the tenant:</p>
            <div className="font-mono text-sm bg-white border border-amber-200 rounded-lg px-4 py-3 space-y-1">
              <p><span className="text-gray-500">Email:</span> {tempCreds.email}</p>
              <p><span className="text-gray-500">Temp password:</span> {tempCreds.password}</p>
            </div>
            <p className="text-xs text-amber-600">The tenant should change their password after first login.</p>
            <button onClick={() => setTempCreds(null)} className="text-xs text-amber-700 hover:underline">Dismiss</button>
          </div>
        )}

        {/* Add member form */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Add tenant</p>
          <form onSubmit={addMember} className="flex gap-2">
            <input
              type="email" placeholder="tenant@email.com" required value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select value={addRole} onChange={e => setAddRole(e.target.value as "ADMIN" | "MEMBER" | "GUEST")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="GUEST">Guest</option>
            </select>
            <button type="submit" disabled={adding}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {adding ? "Adding…" : "Add"}
            </button>
          </form>
          <p className="text-xs text-gray-400">If no account exists for that email, one will be created automatically with a temporary password.</p>
        </div>

        {/* Members list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Members ({apt.members.length})</p>
          </div>
          {apt.members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No members yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {apt.members.map(m => (
                <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                    {m.user.photo
                      ? <img src={m.user.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : m.user.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.user.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {m.role}
                  </span>
                  <div className="flex items-center gap-2">
                    {m.role !== "ADMIN" && (
                      <button onClick={() => setRole(m.id, "ADMIN")} disabled={working === m.id}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                        Make Admin
                      </button>
                    )}
                    {m.role === "ADMIN" && (
                      <button onClick={() => setRole(m.id, "MEMBER")} disabled={working === m.id}
                        className="text-xs text-gray-500 hover:underline disabled:opacity-50">
                        Remove Admin
                      </button>
                    )}
                    <button onClick={() => removeMember(m.id, m.user.name)} disabled={working === m.id}
                      className="text-xs text-orange-500 hover:text-orange-700 disabled:opacity-50">
                      Remove
                    </button>
                    <button onClick={() => deleteAccount(m.user.id, m.user.name)} disabled={working === m.id || working === m.user.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
                      Delete account
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
