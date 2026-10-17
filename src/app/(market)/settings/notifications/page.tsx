"use client";
/**
 * Notifications (fix F13, owner 2026-10-17; the settings are Sprint 9b's):
 * Push and Email, then each topic. Every change saves right away — the old
 * Save button was easy to miss. In the app, everything always shows.
 */
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/market/MarketChrome";
import { Group, PageTitle, SwitchRow, loading, pageWidth, useSignedIn } from "@/components/market/SettingsList";
import { BellIcon, MailIcon } from "@/components/landing/icons";

type Choice = { push: boolean; email: boolean };
interface Prefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  categories: Record<string, Choice>;
  categoryList: { key: string; label: string; description: string }[];
}
type Change = { pushEnabled?: boolean; emailEnabled?: boolean; categories?: Record<string, Partial<Choice>> };

export default function NotificationsPage() {
  const me = useSignedIn();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  // One save at a time, in order: quick taps don't overwrite each other.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!me) return;
    let current = true;
    apiFetch("/api/users/notification-prefs").then(async res => {
      if (!current) return;
      if (res.ok) setPrefs(await res.json()); else setFailed(true);
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [me]);

  function change(patch: Change) {
    setPrefs(p => p && {
      ...p,
      pushEnabled: patch.pushEnabled ?? p.pushEnabled,
      emailEnabled: patch.emailEnabled ?? p.emailEnabled,
      categories: Object.fromEntries(Object.entries(p.categories).map(([k, v]) => [k, { ...v, ...patch.categories?.[k] }])),
    });
    queue.current = queue.current.then(async () => {
      const res = await apiFetch("/api/users/notification-prefs", { method: "PATCH", body: JSON.stringify(patch) }).catch(() => null);
      setNote(res?.ok ? "Saved" : "Couldn't save. Try again.");
      setTimeout(() => setNote(""), 2000);
    });
  }

  if (!me) return loading;
  return (
    <main className={pageWidth}>
      <PageTitle back={{ href: "/settings", label: "Settings" }} title="Notifications"
        subtitle="Choose how we reach you. Everything still shows in the app, and changes save on their own." />

      {failed ? (
        <p className="mt-6 text-sm text-red-600">Couldn&apos;t load your settings. Refresh the page to try again.</p>
      ) : !prefs ? (
        <p className="mt-6 text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <Group title="How we reach you">
            <SwitchRow icon={<BellIcon className="h-5 w-5" />} label="Push notifications" description="Alerts on your phone or browser"
              checked={prefs.pushEnabled} onChange={v => change({ pushEnabled: v })} />
            <SwitchRow icon={<MailIcon className="h-5 w-5" />} label="Email notifications" description="Rent reminders, repair visits, payments"
              checked={prefs.emailEnabled} onChange={v => change({ emailEnabled: v })} />
          </Group>

          {prefs.categoryList.length > 0 && (
            <section className="mt-6">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">By topic</h2>
              <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <span>Topic</span>
                  <span className="flex gap-6"><span className="w-10 text-center">Push</span><span className="w-10 text-center">Email</span></span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {prefs.categoryList.map(c => {
                    const choice = prefs.categories[c.key] ?? { push: true, email: true };
                    return (
                      <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-[15px] text-gray-900 dark:text-white">{c.label}</span>
                          <span className="block text-sm text-gray-500 dark:text-gray-400">{c.description}</span>
                        </span>
                        <span className="flex shrink-0 gap-6">
                          <span className="flex w-10 justify-center">
                            <input type="checkbox" aria-label={`Push for ${c.label}`} checked={choice.push} disabled={!prefs.pushEnabled}
                              onChange={e => change({ categories: { [c.key]: { push: e.target.checked } } })} className="h-5 w-5 accent-brand disabled:opacity-40" />
                          </span>
                          <span className="flex w-10 justify-center">
                            <input type="checkbox" aria-label={`Email for ${c.label}`} checked={choice.email} disabled={!prefs.emailEnabled}
                              onChange={e => change({ categories: { [c.key]: { email: e.target.checked } } })} className="h-5 w-5 accent-brand disabled:opacity-40" />
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">When Push or Email is off above, it&apos;s off for every topic.</p>
            </section>
          )}
        </>
      )}
      <Toast message={note} />
    </main>
  );
}
