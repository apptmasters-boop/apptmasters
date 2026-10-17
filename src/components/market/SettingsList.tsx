"use client";
/**
 * The pieces of More and Settings (fix F13, owner 2026-10-17): grouped rows,
 * a switch, cards, and the top of a Settings page — the round back arrow on
 * phones, a trail like "Settings › Notifications" on computers (as on Airbnb).
 */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackLink } from "./MarketChrome";
import { useMe } from "./useMe";
import { ChevronRightIcon } from "@/components/landing/icons";

/** The signed-in person; a visitor is sent to Log in and comes back here. */
export function useSignedIn() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me === null) router.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }, [me, router]);
  return me;
}

export const loading = <main className="py-16 text-center text-sm text-gray-400">Loading…</main>;

export function Row({ href, icon, label, description, badge, onClick, danger }: {
  href?: string; icon: React.ReactNode; label: string; description?: string; badge?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  const inner = (
    <>
      <span className={danger ? "text-red-600" : "text-gray-700 dark:text-gray-300"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] ${danger ? "text-red-600" : "text-gray-900 dark:text-white"}`}>{label}</span>
        {description && <span className="block text-sm text-gray-500 dark:text-gray-400">{description}</span>}
      </span>
      {badge}
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-400" />
    </>
  );
  const cls = "flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h2>
      <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">{children}</div>
    </section>
  );
}

/** A white card with a title, for the sections of a Settings page. */
export function Card({ title, description, children, id }: { title?: string; description?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {title && <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>}
      {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-brand" : "bg-gray-300 dark:bg-gray-700"}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

/** A label, a line of explanation and a switch on one row. */
export function SwitchRow({ icon, label, description, checked, onChange, disabled }: {
  icon?: React.ReactNode; label: string; description?: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      {icon && <span className="text-gray-700 dark:text-gray-300">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-gray-900 dark:text-white">{label}</span>
        {description && <span className="block text-sm text-gray-500 dark:text-gray-400">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

/** The top of a Settings or Profile page. `back` is where the arrow (and the trail) leads. */
export function PageTitle({ back, title, subtitle, action }: {
  back: { href: string; label: string }; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 hidden items-center gap-1.5 text-sm text-gray-500 lg:flex dark:text-gray-400">
        <Link href={back.href} className="hover:text-gray-900 hover:underline dark:hover:text-white">{back.label}</Link>
        <ChevronRightIcon className="h-4 w-4" />
        <span aria-current="page" className="text-gray-900 dark:text-white">{title}</span>
      </nav>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <BackLink href={back.href} label={back.label} />
          <h1 className="truncate text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        </div>
        {action}
      </div>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

/** Text fields and buttons of the Settings pages. */
export const field = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white";
export const fieldLabel = "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
export const primaryButton = "w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50";
export const pageWidth = "mx-auto max-w-xl px-4 pb-10 pt-6 lg:pt-8";
