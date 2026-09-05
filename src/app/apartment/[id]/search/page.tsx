"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

interface SearchResults {
  chores: { id: string; title: string; status: string; dueDate: string | null; assignedTo: { name: string } | null }[];
  expenses: { id: string; title: string; amount: number; category: string; status: string; notes: string | null }[];
  events: { id: string; title: string; type: string; startDate: string; notes: string | null }[];
  members: { id: string; role: string; user: { id: string; name: string; email: string; roomAssignment: string | null } }[];
  grocery: { id: string; name: string; quantity: string; purchased: boolean; addedBy: { name: string } }[];
  inventory: { id: string; name: string; category: string; quantity: number; unit: string }[];
}

const EMPTY: SearchResults = { chores: [], expenses: [], events: [], members: [], grocery: [], inventory: [] };

export default function SearchPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await apiFetch(`/api/apartments/${apartmentId}/search?q=${encodeURIComponent(query)}`);
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.ok) setResults(await res.json());
      setLoading(false);
    }, 300);
  }, [query, apartmentId]);

  const totalResults = results
    ? results.chores.length + results.expenses.length + results.events.length +
      results.members.length + results.grocery.length + results.inventory.length
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600 shrink-0">← Apartment</Link>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search chores, expenses, members, events…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <NotificationBell apartmentId={apartmentId} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!query.trim() && (
          <p className="text-center text-sm text-gray-400 pt-10">Type to search across chores, expenses, members, events, grocery, and inventory.</p>
        )}
        {query.trim().length === 1 && (
          <p className="text-center text-sm text-gray-400 pt-10">Type at least 2 characters…</p>
        )}
        {loading && (
          <p className="text-center text-sm text-gray-400 pt-10">Searching…</p>
        )}
        {results && !loading && totalResults === 0 && (
          <div className="text-center pt-10">
            <p className="text-gray-500 font-medium">No results for "{query}"</p>
            <p className="text-sm text-gray-400 mt-1">Try a different keyword.</p>
          </div>
        )}

        {results && !loading && totalResults > 0 && (
          <>
            {/* Members */}
            {results.members.length > 0 && (
              <Section title="Members" icon="👤">
                {results.members.map(m => (
                  <Link key={m.user.id} href={`/apartment/${apartmentId}/members/${m.user.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                      <p className="text-xs text-gray-400">{m.user.email}{m.user.roomAssignment ? ` · ${m.user.roomAssignment}` : ""}</p>
                    </div>
                    <span className="text-xs text-gray-400">{m.role}</span>
                  </Link>
                ))}
              </Section>
            )}

            {/* Chores */}
            {results.chores.length > 0 && (
              <Section title="Chores" icon="🧹">
                {results.chores.map(c => (
                  <Link key={c.id} href={`/apartment/${apartmentId}/chores`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.title}</p>
                      <p className="text-xs text-gray-400">
                        {c.status}{c.assignedTo ? ` · ${c.assignedTo.name}` : ""}
                        {c.dueDate ? ` · Due ${new Date(c.dueDate).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === "DONE" ? "bg-emerald-100 text-emerald-700" : c.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.status}
                    </span>
                  </Link>
                ))}
              </Section>
            )}

            {/* Expenses */}
            {results.expenses.length > 0 && (
              <Section title="Expenses" icon="💸">
                {results.expenses.map(e => (
                  <Link key={e.id} href={`/apartment/${apartmentId}/finance`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.title}</p>
                      <p className="text-xs text-gray-400">{e.category}{e.notes ? ` · ${e.notes}` : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">${e.amount.toFixed(2)}</span>
                  </Link>
                ))}
              </Section>
            )}

            {/* Calendar events */}
            {results.events.length > 0 && (
              <Section title="Events" icon="📅">
                {results.events.map(ev => (
                  <Link key={ev.id} href={`/apartment/${apartmentId}/calendar`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                      <p className="text-xs text-gray-400">
                        {ev.type} · {new Date(ev.startDate + "T12:00:00").toLocaleDateString()}
                        {ev.notes ? ` · ${ev.notes}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </Section>
            )}

            {/* Grocery */}
            {results.grocery.length > 0 && (
              <Section title="Grocery" icon="🛒">
                {results.grocery.map(g => (
                  <Link key={g.id} href={`/apartment/${apartmentId}/grocery`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className={`text-sm font-medium ${g.purchased ? "line-through text-gray-400" : "text-gray-900"}`}>{g.name}</p>
                      <p className="text-xs text-gray-400">{g.quantity ? `Qty: ${g.quantity} · ` : ""}{g.addedBy.name}</p>
                    </div>
                    {g.purchased && <span className="text-xs text-emerald-600 font-medium">Bought</span>}
                  </Link>
                ))}
              </Section>
            )}

            {/* Inventory */}
            {results.inventory.length > 0 && (
              <Section title="Inventory" icon="📦">
                {results.inventory.map(i => (
                  <Link key={i.id} href={`/apartment/${apartmentId}/inventory`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{i.name}</p>
                      <p className="text-xs text-gray-400">{i.category} · {i.quantity} {i.unit}</p>
                    </div>
                  </Link>
                ))}
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span>{icon}</span>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}
