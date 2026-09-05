"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface Chore {
  id: string; title: string; status: string; dueDate: string | null; points: number;
  room: { name: string } | null;
}
interface ScoreLog { id: string; delta: number; reason: string; createdAt: string }
interface MemberData {
  userId: string; name: string; email: string; photo: string | null;
  roomAssignment: string | null; moveInDate: string | null; dietaryFlags: string;
  role: string; joinedAt: string;
  score: number | null; scoreTier: string; scoreLogs: ScoreLog[];
  paid: number; owed: number;
  choresDone: number; choresPending: number;
  assignedChores: Chore[];
}

function scoreTier(score: number) {
  if (score >= 80) return { label: "Great", color: "text-emerald-600" };
  if (score >= 60) return { label: "Good", color: "text-blue-600" };
  if (score >= 40) return { label: "Fair", color: "text-amber-600" };
  return { label: "Needs work", color: "text-red-600" };
}

export default function MemberProfilePage() {
  const { id: apartmentId, userId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const [member, setMember] = useState<MemberData | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    async function load() {
      const [aptRes, statsRes, scoresRes, choresRes] = await Promise.all([
        apiFetch(`/api/apartments/${apartmentId}`),
        apiFetch(`/api/apartments/${apartmentId}/stats`),
        apiFetch(`/api/apartments/${apartmentId}/scores`),
        apiFetch(`/api/apartments/${apartmentId}/chores`),
      ]);
      if (aptRes.status === 401) { router.replace("/login"); return; }

      const apt = await aptRes.json();
      const stats = statsRes.ok ? await statsRes.json() : null;
      const scoresData = scoresRes.ok ? await scoresRes.json() : [];
      const chores: Chore[] = choresRes.ok ? await choresRes.json() : [];

      setCurrentUserId(apt.currentUserId ?? "");

      const memberEntry = apt.members.find((m: { user: { id: string } }) => m.user.id === userId);
      if (!memberEntry) { router.replace(`/apartment/${apartmentId}`); return; }

      const memberStats = stats?.memberStats?.find((m: { userId: string }) => m.userId === userId);
      const scoreEntry = scoresData.find((s: { userId: string }) => s.userId === userId);

      setMember({
        userId,
        name: memberEntry.user.name,
        email: memberEntry.user.email,
        photo: memberEntry.user.photo,
        roomAssignment: memberEntry.user.roomAssignment,
        moveInDate: memberEntry.user.moveInDate,
        dietaryFlags: memberEntry.user.dietaryFlags,
        role: memberEntry.role,
        joinedAt: memberEntry.joinedAt,
        score: scoreEntry?.score ?? null,
        scoreTier: scoreEntry?.tier ?? "Fair",
        scoreLogs: scoreEntry?.logs ?? [],
        paid: memberStats?.paid ?? 0,
        owed: memberStats?.owed ?? 0,
        choresDone: memberStats?.choresDone ?? 0,
        choresPending: memberStats?.choresPending ?? 0,
        assignedChores: chores.filter(c => {
          const ch = c as unknown as { assignedTo: { id: string } | null };
          return ch.assignedTo?.id === userId && c.status !== "DONE";
        }),
      });
      setLoading(false);
    }
    load();
  }, [apartmentId, userId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!member) return null;

  const tier = member.score !== null ? scoreTier(member.score) : { label: member.scoreTier, color: "text-gray-500" };
  const dietary: string[] = JSON.parse(member.dietaryFlags || "[]");
  const isSelf = currentUserId === userId;

  const DIETARY_LABELS: Record<string, string> = {
    VEGAN: "Vegan", VEGETARIAN: "Vegetarian", GLUTEN_FREE: "Gluten-free",
    DAIRY_FREE: "Dairy-free", NUT_FREE: "Nut-free", HALAL: "Halal", KOSHER: "Kosher",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">{member.name}</span>
          {isSelf && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">You</span>}
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell apartmentId={apartmentId} />
          {isSelf && (
            <Link href="/profile" className="text-xs text-blue-500 hover:underline font-medium">Edit profile</Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Identity card */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600 flex-shrink-0 overflow-hidden">
            {member.photo
              ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              : member.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg">{member.name}</p>
            <p className="text-sm text-gray-500">{member.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{member.role}</span>
              {member.roomAssignment && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{member.roomAssignment}</span>
              )}
              {member.moveInDate && (
                <span className="text-xs text-gray-400">Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
              )}
            </div>
            {dietary.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {dietary.map(d => (
                  <span key={d} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{DIETARY_LABELS[d] ?? d}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Total paid</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">${member.paid.toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Total owed</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">${member.owed.toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Chores done</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{member.choresDone}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Chores pending</p>
            <p className={`text-xl font-bold mt-0.5 ${member.choresPending > 0 ? "text-amber-600" : "text-gray-400"}`}>
              {member.choresPending}
            </p>
          </div>
        </div>

        {/* Score */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Roommate score</p>
            <button onClick={() => setShowLogs(s => !s)} className="text-xs text-blue-500 hover:underline">
              {showLogs ? "Hide history" : "View history"}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
              {member.score !== null ? (
                <div className={`h-full rounded-full transition-all ${member.score >= 80 ? "bg-emerald-500" : member.score >= 60 ? "bg-blue-500" : member.score >= 40 ? "bg-amber-400" : "bg-red-500"}`}
                  style={{ width: `${member.score}%` }} />
              ) : (
                <div className="h-full rounded-full bg-gray-300" style={{ width: "50%" }} />
              )}
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${tier.color}`}>
                {member.score !== null ? member.score : "–"}
              </p>
              <p className={`text-xs font-medium ${tier.color}`}>{tier.label}</p>
            </div>
          </div>
          {showLogs && member.scoreLogs.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
              {member.scoreLogs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{log.reason}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${log.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {log.delta >= 0 ? "+" : ""}{log.delta}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showLogs && member.scoreLogs.length === 0 && (
            <p className="mt-4 text-sm text-gray-400 text-center border-t border-gray-100 pt-3">No score history yet.</p>
          )}
        </div>

        {/* Assigned chores */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Active chores</p>
          {member.assignedChores.length === 0 ? (
            <p className="text-sm text-gray-400">No active chores assigned.</p>
          ) : (
            <div className="space-y-2">
              {member.assignedChores.map(chore => (
                <div key={chore.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800 font-medium">{chore.title}</p>
                    {chore.room && <p className="text-xs text-gray-400">{chore.room.name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {chore.dueDate && (
                      <p className="text-xs text-gray-400">{new Date(chore.dueDate).toLocaleDateString()}</p>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chore.status === "OVERDUE" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                      {chore.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Move-out report link */}
        <Link href={`/apartment/${apartmentId}/moveout/${userId}`}
          className="block text-center text-xs text-gray-400 hover:text-gray-600 py-2">
          View move-out report →
        </Link>
      </main>
    </div>
  );
}
