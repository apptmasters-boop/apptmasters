"use client";
/**
 * More → Home settings, for household admins: the announcement, join requests,
 * and managing members (role, status, guest access, removal). The server
 * checks the admin role on every one of these actions; this page just hides
 * them from everyone else.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BackLink } from "@/components/home/HomeNav";
import { useApartment, pageClass, type Member } from "@/components/home/useApartment";

interface JoinRequest { id: string; user: { id: string; name: string; email: string } }

const ROLE_LABEL: Record<string, string> = { ADMIN: "Household admin", MEMBER: "Member", GUEST: "Guest" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Living here", VACATION: "Away", MOVED_OUT: "Moved out" };
const chip = (on: boolean) =>
  `rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-brand bg-brand text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`;

export default function HomeSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apt, failed, reload, isAdmin } = useApartment(id);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [announcement, setAnnouncement] = useState<string | null>(null); // null = not editing

  const loadJoinRequests = useCallback((isCurrent: () => boolean = () => true) =>
    apiFetch(`/api/apartments/${id}/join-requests`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (isCurrent()) setJoinRequests(data); })
      .catch(() => {}), [id]);
  useEffect(() => {
    if (!isAdmin) return;
    let current = true;
    loadJoinRequests(() => current);
    return () => { current = false; };
  }, [isAdmin, loadJoinRequests]);

  if (failed) return <p className="p-8 text-center text-sm text-gray-500">Couldn&apos;t load settings. Please refresh.</p>;
  if (!apt) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (!isAdmin) {
    return (
      <main className={pageClass}>
        <BackLink />
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Home settings</h1>
        <p className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-5 text-sm text-gray-600">Only household admins can change these settings.</p>
      </main>
    );
  }

  async function saveAnnouncement(text: string | null) {
    await apiFetch(`/api/apartments/${id}`, { method: "PATCH", body: JSON.stringify({ announcement: text || null }) });
    setAnnouncement(null);
    reload();
  }
  async function updateMember(memberId: string, update: { role?: string; status?: string; expiresAt?: string | null }) {
    const res = await apiFetch(`/api/apartments/${id}/members/${memberId}`, { method: "PATCH", body: JSON.stringify(update) });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Could not update this member.");
    reload();
  }
  async function removeMember(m: Member) {
    const isMe = m.user.id === apt!.currentUserId;
    if (!confirm(isMe ? "Leave this home? This can't be undone." : `Remove ${m.user.name} from this home?`)) return;
    const res = await apiFetch(`/api/apartments/${id}/members/${m.id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? "Could not remove this member."); return; }
    if (isMe) { router.replace("/dashboard"); return; }
    reload();
  }
  async function answerJoin(memberId: string, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Decline this request to join?")) return;
    await apiFetch(`/api/apartments/${id}/join-requests/${memberId}/${action}`, { method: "POST" });
    loadJoinRequests();
    reload();
  }

  return (
    <main className={pageClass}>
      <BackLink />
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Home settings</h1>
      <p className="mt-1 text-sm text-gray-500">For household admins of {apt.name}.</p>

      {joinRequests.length > 0 && (
        <section className="mt-6" aria-labelledby="jr">
          <h2 id="jr" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Asking to join ({joinRequests.length})</h2>
          <ul className="space-y-2">
            {joinRequests.map(jr => (
              <li key={jr.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{jr.user.name}</span>
                  <span className="block truncate text-xs text-gray-500">{jr.user.email}</span>
                </span>
                <button onClick={() => answerJoin(jr.id, "approve")} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">Approve</button>
                <button onClick={() => answerJoin(jr.id, "reject")} className="px-2 py-1.5 text-xs font-medium text-red-600 hover:underline">Decline</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="ann">
        <h2 id="ann" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Announcement</h2>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          {announcement !== null ? (
            <div className="space-y-2">
              <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={3} placeholder="A message everyone sees at the top of Home…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
              <div className="flex gap-2">
                <button onClick={() => saveAnnouncement(announcement)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Save</button>
                <button onClick={() => setAnnouncement(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <p className="flex-1 text-sm text-gray-700">{apt.announcement ?? <span className="italic text-gray-400">No announcement</span>}</p>
              <button onClick={() => setAnnouncement(apt.announcement ?? "")} className="text-xs font-semibold text-brand hover:underline">{apt.announcement ? "Edit" : "Add"}</button>
              {apt.announcement && <button onClick={() => saveAnnouncement(null)} className="text-xs font-medium text-red-600 hover:underline">Clear</button>}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="mem">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="mem" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Members</h2>
          <Link href={`/apartment/${id}/audit`} className="text-xs text-gray-500 hover:underline">Audit log →</Link>
        </div>
        <ul className="space-y-2.5">
          {apt.members.map(m => {
            const isMe = m.user.id === apt.currentUserId;
            return (
              <li key={m.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{m.user.name}{isMe && " (you)"}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <Link href={`/apartment/${id}/moveout/${m.user.id}`} className="text-gray-500 hover:underline">Move-out report</Link>
                    <button onClick={() => removeMember(m)} className="font-medium text-red-600 hover:underline">{isMe ? "Leave" : "Remove"}</button>
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">Role</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(["ADMIN", "MEMBER", "GUEST"] as const).map(r => (
                    <button key={r} onClick={() => updateMember(m.id, { role: r })} aria-pressed={m.role === r} className={chip(m.role === r)}>{ROLE_LABEL[r]}</button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">Status</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(["ACTIVE", "VACATION", "MOVED_OUT"] as const).map(s => (
                    <button key={s} onClick={() => updateMember(m.id, { status: s })} aria-pressed={m.status === s} className={chip(m.status === s)}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
                {m.role === "GUEST" && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                    Guest access until
                    <input type="date" defaultValue={m.expiresAt?.split("T")[0] ?? ""}
                      onChange={e => updateMember(m.id, { expiresAt: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null })}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                    {m.expiresAt && <span className="font-medium text-amber-700">{new Date(m.expiresAt) < new Date() ? "Expired" : "Active"}</span>}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
