"use client";
/**
 * Home: "What needs my attention now?" (docs/PRODUCT_LOGIC.md §6). A short
 * list ordered by priority, built by GET /api/apartments/[id]/home
 * (src/lib/homeFeed.ts). Not a grid of features: everything else is one tap
 * away in Household, Money, Chat and More.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { FeedItem } from "@/lib/homeFeed";
import NotificationBell from "@/components/NotificationBell";
import { ChevronRightIcon, CheckIcon, CalendarIcon, MessageIcon } from "@/components/landing/icons";

interface HomeData {
  apartmentName: string;
  firstName: string;
  announcement: { text: string; at: string | null } | null;
  items: FeedItem[];
}

const STYLE: Record<1 | 2 | 3, { label: string; card: string; dot: string }> = {
  1: { label: "Urgent", card: "border-red-200 bg-red-50/70 dark:bg-red-950/30", dot: "bg-red-500" },
  2: { label: "Money", card: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/30", dot: "bg-amber-500" },
  3: { label: "Your turn", card: "border-gray-200 bg-white", dot: "bg-brand" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ActionCard({ item }: { item: FeedItem }) {
  const s = STYLE[item.priority as 1 | 2 | 3];
  return (
    <Link href={item.href} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-shadow hover:shadow-sm ${s.card}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
        <span className="mt-0.5 block text-xs text-gray-600">
          <span className="sr-only">{s.label}: </span>
          {item.overdue && <span className="font-semibold text-red-600">Late · </span>}
          {item.detail}
        </span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  );
}

export default function HomePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch(`/api/apartments/${id}/home`).then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      if (!res.ok) { setFailed(true); return; }
      setData(await res.json());
    }).catch(() => setFailed(true));
  }, [id, router]);

  if (failed) return <p className="p-8 text-center text-sm text-gray-500">Couldn&apos;t load your home. Please refresh.</p>;
  if (!data) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">Loading…</div>;

  const now = data.items.filter(i => i.priority <= 3);
  const upcoming = data.items.filter(i => i.priority === 4);
  const recent = data.items.filter(i => i.priority === 5);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{data.apartmentName}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">{greeting()}{data.firstName ? `, ${data.firstName}` : ""}</h1>
        </div>
        <NotificationBell apartmentId={id} />
      </header>

      {data.announcement && (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3 dark:bg-brand/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">Announcement</p>
          <p className="mt-1 text-sm text-gray-800">{data.announcement.text}</p>
        </div>
      )}

      <section className="mt-6" aria-labelledby="now-heading">
        <h2 id="now-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Needs your attention</h2>
        {now.length > 0 ? (
          <div className="space-y-2.5">{now.map(item => <ActionCard key={item.id} item={item} />)}</div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200">
              <CheckIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">You&apos;re all caught up</span>
              <span className="block text-xs text-gray-500">Nothing needs you right now.</span>
            </span>
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Coming up</h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {upcoming.map(item => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{item.title}</span>
                  <span className="shrink-0 text-xs text-gray-500">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-8" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recently</h2>
          <ul className="space-y-1.5">
            {recent.map(item => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                  <MessageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
