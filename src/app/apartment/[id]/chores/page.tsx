"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import IconBadge from "@/components/IconBadge";
import { ChoresIcon } from "@/components/icons";

interface Member { id: string; name: string }
interface SwapRequest { id: string; fromUser: { id: string; name: string }; toUser: { id: string; name: string }; status: string }
interface Chore {
  id: string; title: string; status: string; assignmentType: string; frequency: string;
  dueDate: string | null; points: number; roomId: string | null;
  room: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  completedBy: { name: string } | null;
  swapRequests: SwapRequest[];
}

const FREQ_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly" };
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  OVERDUE: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

export default function AllChoresPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [nudged, setNudged] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [swapToUserId, setSwapToUserId] = useState("");
  const [view, setView] = useState<"active" | "history">("active");

  // Filters
  const [quickFilter, setQuickFilter] = useState<"all" | "mine" | "overdue">("all");
  const [filterMember, setFilterMember] = useState<string>("all");
  const filterStatus = quickFilter === "overdue" ? "OVERDUE" : "all";

  async function load() {
    const [choresRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/chores`),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (choresRes.status === 401) { router.replace("/login"); return; }
    setChores(await choresRes.json());
    const apt = await aptRes.json();
    setMembers(apt.members.map((m: { user: Member }) => m.user));
    setCurrentUserId(apt.currentUserId ?? "");
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function completeChore(choreId: string) {
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/complete`, { method: "POST", body: "{}" });
    load();
  }

  async function nudge(chore: Chore) {
    const res = await apiFetch(`/api/apartments/${apartmentId}/chores/${chore.id}/nudge`, { method: "POST" });
    const data = await res.json();
    setNudged(`Nudged ${data.assignee} about "${data.chore}"`);
    setTimeout(() => setNudged(null), 3000);
  }

  async function deleteChore(choreId: string) {
    if (!confirm("Delete this chore?")) return;
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}`, { method: "DELETE" });
    load();
  }

  async function requestSwap(choreId: string) {
    if (!swapToUserId) return;
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/swap`, {
      method: "POST",
      body: JSON.stringify({ toUserId: swapToUserId }),
    });
    setSwapTarget(null);
    setSwapToUserId("");
    load();
  }

  async function respondSwap(choreId: string, swapId: string, accept: boolean) {
    await apiFetch(`/api/apartments/${apartmentId}/chores/${choreId}/swap`, {
      method: "POST",
      body: JSON.stringify({ swapId, accept }),
    });
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const pendingSwaps = chores.filter(c =>
    c.swapRequests.some(s => s.toUser.id === currentUserId && s.status === "PENDING")
  );

  const effectiveMemberFilter = quickFilter === "mine" ? currentUserId : filterMember;

  const filtered = chores.filter(c => {
    if (c.status === "DONE") return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (effectiveMemberFilter !== "all" && c.assignedTo?.id !== effectiveMemberFilter) return false;
    return true;
  });

  const overdue = filtered.filter(c => c.status === "OVERDUE");
  const pending = filtered.filter(c => c.status === "PENDING");
  const myChores = filtered.filter(c => c.assignedTo?.id === currentUserId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">All Chores</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell apartmentId={apartmentId} />
          <Link href={`/apartment/${apartmentId}/rooms`} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Rooms
          </Link>
        </div>
      </header>

      {nudged && (
        <div className="bg-indigo-600 text-white text-sm text-center py-2 px-4">{nudged}</div>
      )}


      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">My chores</p>
            <p className="text-xl font-bold text-indigo-600 mt-0.5">{myChores.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Total pending</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{pending.length + overdue.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">Overdue</p>
            <p className={`text-xl font-bold mt-0.5 ${overdue.length > 0 ? "text-red-600" : "text-gray-400"}`}>{overdue.length}</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["active", "history"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {v === "active" ? "Active" : "History"}
            </button>
          ))}
        </div>

        {/* History view */}
        {view === "history" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">All members</option>
                <option value={currentUserId}>My chores</option>
                {members.filter(m => m.id !== currentUserId).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {chores.filter(c => c.status === "DONE" && (filterMember === "all" || (c as unknown as { completedBy: { id: string } | null }).completedBy?.id === filterMember || c.assignedTo?.id === filterMember)).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <p className="text-gray-400">No completed chores yet.</p>
              </div>
            ) : (
              chores
                .filter(c => c.status === "DONE" && (filterMember === "all" || (c as unknown as { completedBy: { id: string } | null }).completedBy?.id === filterMember || c.assignedTo?.id === filterMember))
                .map(chore => (
                  <div key={chore.id} className="bg-white border border-green-100 rounded-xl px-5 py-4 flex items-center gap-3">
                    <IconBadge icon={<ChoresIcon />} color="green" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{chore.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {FREQ_LABELS[chore.frequency]} · {chore.points} pts
                        {chore.room && ` · ${chore.room.name}`}
                        {chore.completedBy && ` · Done by ${chore.completedBy.name}`}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Done</span>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Active view */}
        {view === "active" && (
          <>
            {pendingSwaps.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  {pendingSwaps.length} pending swap request{pendingSwaps.length > 1 ? "s" : ""}
                </p>
                {pendingSwaps.map(chore => {
                  const swap = chore.swapRequests.find(s => s.toUser.id === currentUserId && s.status === "PENDING")!;
                  return (
                    <div key={chore.id} className="flex items-center justify-between py-1">
                      <p className="text-sm text-amber-700">
                        <span className="font-medium">{swap.fromUser.name}</span> → "{chore.title}"
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => respondSwap(chore.id, swap.id, true)}
                          className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-green-700 transition-colors">
                          Accept
                        </button>
                        <button onClick={() => respondSwap(chore.id, swap.id, false)}
                          className="text-xs bg-white text-red-600 border border-red-200 px-2.5 py-1 rounded-md font-medium hover:bg-red-50 transition-colors">
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { key: "all", label: "All" },
                { key: "mine", label: "My Chores" },
                { key: "overdue", label: "Overdue" },
              ] as const).map(f => (
                <button key={f.key} onClick={() => setQuickFilter(f.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${quickFilter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {quickFilter !== "mine" && (
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">All members</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.id === currentUserId ? `${m.name} (you)` : m.name}</option>
                ))}
              </select>
            )}

            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <p className="text-gray-400">No chores match your filters.</p>
              </div>
            )}

            {overdue.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Overdue</p>
                <div className="space-y-3">
                  {overdue.map(chore => (
                    <ChoreCard key={chore.id} chore={chore} currentUserId={currentUserId} members={members}
                      swapTarget={swapTarget} swapToUserId={swapToUserId}
                      onComplete={() => completeChore(chore.id)}
                      onNudge={() => nudge(chore)}
                      onDelete={() => deleteChore(chore.id)}
                      onSwapRequest={() => requestSwap(chore.id)}
                      onSwapRespond={(swapId, accept) => respondSwap(chore.id, swapId, accept)}
                      onSwapOpen={() => { setSwapTarget(chore.id); setSwapToUserId(""); }}
                      onSwapClose={() => { setSwapTarget(null); setSwapToUserId(""); }}
                      onSwapToChange={setSwapToUserId}
                      apartmentId={apartmentId}
                    />
                  ))}
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div>
                {overdue.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pending</p>}
                <div className="space-y-3">
                  {pending.map(chore => (
                    <ChoreCard key={chore.id} chore={chore} currentUserId={currentUserId} members={members}
                      swapTarget={swapTarget} swapToUserId={swapToUserId}
                      onComplete={() => completeChore(chore.id)}
                      onNudge={() => nudge(chore)}
                      onDelete={() => deleteChore(chore.id)}
                      onSwapRequest={() => requestSwap(chore.id)}
                      onSwapRespond={(swapId, accept) => respondSwap(chore.id, swapId, accept)}
                      onSwapOpen={() => { setSwapTarget(chore.id); setSwapToUserId(""); }}
                      onSwapClose={() => { setSwapTarget(null); setSwapToUserId(""); }}
                      onSwapToChange={setSwapToUserId}
                      apartmentId={apartmentId}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ChoreCard({
  chore, currentUserId, members, swapTarget, swapToUserId,
  onComplete, onNudge, onDelete, onSwapRequest, onSwapRespond,
  onSwapOpen, onSwapClose, onSwapToChange, apartmentId,
}: {
  chore: Chore; currentUserId: string; members: Member[];
  swapTarget: string | null; swapToUserId: string;
  onComplete: () => void; onNudge: () => void; onDelete: () => void;
  onSwapRequest: () => void; onSwapRespond: (swapId: string, accept: boolean) => void;
  onSwapOpen: () => void; onSwapClose: () => void;
  onSwapToChange: (v: string) => void;
  apartmentId: string;
}) {
  const isMyChore = chore.assignedTo?.id === currentUserId;
  const incomingSwap = chore.swapRequests.find(s => s.toUser.id === currentUserId && s.status === "PENDING");
  const outgoingSwap = chore.swapRequests.find(s => s.fromUser.id === currentUserId && s.status === "PENDING");
  const isSwapOpen = swapTarget === chore.id;

  return (
    <div className={`bg-white border rounded-xl px-5 py-4 ${chore.status === "OVERDUE" ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-start gap-3 mb-3">
        <IconBadge icon={<ChoresIcon />} color={chore.status === "OVERDUE" ? "red" : "orange"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-gray-900">{chore.title}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[chore.status] ?? "bg-gray-100 text-gray-500"}`}>
              {chore.status}
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${chore.status === "OVERDUE" ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {FREQ_LABELS[chore.frequency]} · {chore.points} pts
            {chore.room && <> · <Link href={`/apartment/${apartmentId}/rooms/${chore.room.id}`} className="hover:text-indigo-500">{chore.room.name}</Link></>}
            {chore.dueDate && ` · Due ${new Date(chore.dueDate).toLocaleDateString()}`}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
              {chore.assignedTo?.name[0]?.toUpperCase() ?? "?"}
            </span>
            <p className="text-xs text-gray-500">{chore.assignedTo?.name ?? "Unassigned"}</p>
          </div>
        </div>
      </div>

      {incomingSwap && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
          <p className="text-xs text-amber-700 font-medium">{incomingSwap.fromUser.name} wants you to take this</p>
          <div className="flex gap-2">
            <button onClick={() => onSwapRespond(incomingSwap.id, true)}
              className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-green-700 transition-colors">
              Accept
            </button>
            <button onClick={() => onSwapRespond(incomingSwap.id, false)}
              className="text-xs bg-white text-red-600 border border-red-200 px-2.5 py-1 rounded-md font-medium hover:bg-red-50 transition-colors">
              Decline
            </button>
          </div>
        </div>
      )}

      {outgoingSwap && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-indigo-700">Swap pending → {outgoingSwap.toUser.name}</p>
        </div>
      )}

      {isSwapOpen && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 mb-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">Request swap with:</p>
          <select value={swapToUserId} onChange={e => onSwapToChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Pick a roommate…</option>
            {members.filter(m => m.id !== currentUserId).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={onSwapRequest} disabled={!swapToUserId}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Send request
            </button>
            <button onClick={onSwapClose} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button onClick={onComplete}
          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg font-medium hover:bg-green-100 transition-colors">
          Done
        </button>
        {chore.assignedTo && (
          <button onClick={onNudge}
            className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-lg font-medium hover:bg-yellow-100 transition-colors">
            Nudge
          </button>
        )}
        {isMyChore && !outgoingSwap && !incomingSwap && !isSwapOpen && (
          <button onClick={onSwapOpen}
            className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg font-medium hover:bg-purple-100 transition-colors">
            Swap
          </button>
        )}
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 px-2">✕</button>
      </div>
    </div>
  );
}
