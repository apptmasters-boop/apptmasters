"use client";
/**
 * The pieces Create a Home and Join a Home share (Home Setup, Sprint 11b;
 * owner's designs in docs/mockups/create-home-mobile.jpg and
 * join-home-mobile.jpg): a back arrow with the title, numbered steps, white
 * cards, fields and the join request timeline.
 */
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "@/components/landing/icons";

export function SetupPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white pb-16 sm:bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-6 sm:pt-10">{children}</div>
    </main>
  );
}

const backClass = "-ms-1 mt-1 rounded-full p-1 text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800";

/** Back arrow, title and subtitle. `onBack` goes one step back; otherwise the arrow links to `backHref`. */
export function SetupHeader({ title, subtitle, onBack, backHref = "/listings" }: {
  title: string; subtitle?: string; onBack?: () => void; backHref?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" className={backClass}><ArrowLeftIcon className="h-6 w-6" /></button>
      ) : (
        <Link href={backHref} aria-label="Back" className={backClass}><ArrowLeftIcon className="h-6 w-6" /></Link>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Numbered steps; finished ones show a check mark. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mt-6 flex items-start" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center" aria-current={active ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`absolute end-1/2 top-4 h-0.5 w-full ${i <= current ? "bg-brand" : "bg-gray-200 dark:bg-gray-700"}`} />}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              done || active ? "bg-brand text-white" : "bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"}`}>
              {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-xs ${active ? "font-semibold text-brand dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SetupCard({ title, subtitle, children, className = "" }: {
  title?: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white";
export const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60";
export const textButton = "mt-3 block w-full rounded-xl py-2 text-center text-sm font-semibold text-brand hover:bg-brand-soft dark:text-emerald-300 dark:hover:bg-brand/20";

/** A labelled field; `icon` sits inside the input on the left. */
export function Field({ id, label, optional, hint, icon, children }: {
  id: string; label: string; optional?: boolean; hint?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}{optional && <span className="font-normal text-gray-400"> (optional)</span>}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>}
        {children}
      </div>
      {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{message}</p>;
}

export const longDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** A join request's progress: sent, under review, and the answer still to come. */
export function RequestTimeline({ requestedAt }: { requestedAt: string | Date }) {
  const sent = new Date(requestedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const steps = [
    { title: "Request sent", detail: sent, done: true },
    { title: "Under review", detail: "The household admin is reviewing your request.", done: true },
    { title: "Response", detail: "You'll get an email when they answer.", done: false },
  ];
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className={`absolute start-[11px] top-6 h-full w-0.5 ${steps[i + 1].done ? "bg-brand" : "bg-gray-200 dark:bg-gray-700"}`} />}
          <span className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            s.done ? "bg-brand text-white" : "border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"}`}>
            {s.done && <CheckIcon className="h-3.5 w-3.5" />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">{s.title}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
