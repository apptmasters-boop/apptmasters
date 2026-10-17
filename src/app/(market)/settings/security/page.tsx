"use client";
/**
 * Login & security (fix F13, owner 2026-10-17; Airbnb's name for the same
 * page): your password, two-step sign-in with its backup codes, and recent
 * sign-ins. It was the bottom of the old long profile page.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { refreshMe, type Me } from "@/components/market/useMe";
import { Card, PageTitle, Switch, field, fieldLabel, loading, pageWidth, primaryButton, useSignedIn } from "@/components/market/SettingsList";
import { KeyIcon, LogInIcon } from "@/components/icons";

interface LoginEvent { id: string; ip: string; userAgent: string | null; success: boolean; createdAt: string }

function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = userAgent.includes("Edg/") ? "Edge" : userAgent.includes("Chrome/") ? "Chrome" : userAgent.includes("Firefox/") ? "Firefox" : userAgent.includes("Safari/") ? "Safari" : "Unknown browser";
  const os = userAgent.includes("iPhone") ? "iPhone" : userAgent.includes("Android") ? "Android" : userAgent.includes("Mac OS X") ? "Mac" : userAgent.includes("Windows") ? "Windows" : "Unknown device";
  return `${browser} on ${os}`;
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (form.newPassword !== form.confirmPassword) { setError("The new passwords don't match."); return; }
    setSaving(true);
    const res = await apiFetch("/api/users/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setDone(true);
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));
  return (
    <Card title="Password">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="sec-current" className={fieldLabel}>Current password</label>
          <input id="sec-current" type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} className={field} />
        </div>
        <div>
          <label htmlFor="sec-new" className={fieldLabel}>New password</label>
          <input id="sec-new" type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} className={field} />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character.</p>
        </div>
        <div>
          <label htmlFor="sec-confirm" className={fieldLabel}>Confirm new password</label>
          <input id="sec-confirm" type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} className={field} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {done && <p role="status" className="text-sm text-brand dark:text-emerald-300">Password changed.</p>}
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Change password"}</button>
      </form>
    </Card>
  );
}

function TwoStepCard({ me }: { me: Me }) {
  const [enabled, setEnabled] = useState(!!me.twoFactorEnabled);
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let current = true;
    apiFetch("/api/users/2fa/backup-codes").then(async res => {
      if (res.ok && current) setRemaining((await res.json()).remaining);
    }).catch(() => {});
    return () => { current = false; };
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    const res = await apiFetch("/api/users/2fa", { method: "PATCH", body: JSON.stringify({ enabled: next }) });
    setSaving(false);
    if (res.ok) { setEnabled(next); refreshMe(); }
  }

  async function generate() {
    if (remaining && !confirm("New codes replace the ones you have now. Continue?")) return;
    setGenerating(true);
    const res = await apiFetch("/api/users/2fa/backup-codes", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCodes(data.codes);
      setRemaining(data.codes.length);
    }
    setGenerating(false);
  }

  return (
    <Card title="Two-step sign-in" description="Ask for a code from your email each time you sign in.">
      <div className="flex items-center gap-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-gray-900 dark:text-white">Email codes</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">{enabled ? "On" : "Off"}</span>
        </span>
        <Switch checked={enabled} onChange={toggle} label="Email codes" disabled={saving} />
      </div>

      {enabled && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><KeyIcon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-gray-900 dark:text-white">Backup codes</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                {codes ? "Save these now: they won't be shown again." :
                  remaining ? `${remaining} unused code${remaining === 1 ? "" : "s"} left` : "For when you can't get the emailed code"}
              </span>
            </span>
            <button type="button" onClick={generate} disabled={generating} className="shrink-0 text-sm font-semibold text-brand hover:underline disabled:opacity-50 dark:text-emerald-300">
              {generating ? "…" : remaining ? "New codes" : "Get codes"}
            </button>
          </div>
          {codes && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
              <div className="grid grid-cols-2 gap-1.5 font-mono text-sm text-gray-800 dark:text-gray-100">
                {codes.map(code => <span key={code}>{code}</span>)}
              </div>
              <button type="button" onClick={() => navigator.clipboard.writeText(codes.join("\n"))} className="mt-2 text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
                Copy all
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function RecentSignIns() {
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  useEffect(() => {
    let current = true;
    apiFetch("/api/users/login-events").then(async res => {
      if (current) setEvents(res.ok ? await res.json() : []);
    }).catch(() => { if (current) setEvents([]); });
    return () => { current = false; };
  }, []);

  return (
    <Card title="Recent sign-ins" description="If you don't recognize one, change your password.">
      {events === null ? <p className="text-sm text-gray-400">Loading…</p> : events.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No sign-ins recorded yet.</p>
      ) : (
        <ul className="-my-2 divide-y divide-gray-100 dark:divide-gray-800">
          {events.map(ev => (
            <li key={ev.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ev.success ? "bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200" : "bg-red-100 text-red-600"}`}>
                <LogInIcon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-900 dark:text-white">{ev.success ? "Signed in" : "Failed sign-in attempt"}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{describeUserAgent(ev.userAgent)} · {ev.ip}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SecurityPage() {
  const me = useSignedIn();
  if (!me) return loading;
  return (
    <main className={pageWidth}>
      <PageTitle back={{ href: "/settings", label: "Settings" }} title="Login & security"
        subtitle="Your password, two-step sign-in and recent sign-ins." />
      <PasswordCard />
      <TwoStepCard me={me} />
      <RecentSignIns />
    </main>
  );
}
