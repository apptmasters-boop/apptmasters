"use client";

import Link from "next/link";
import PageWrapper from "./PageWrapper";

interface ErrorPageProps {
  error: Error;
  reset?: () => void;
  homeHref?: string;
  reloadHref?: string;
}

const isProduction = process.env.NODE_ENV === "production";

export default function ErrorPage({
  error,
  reset,
  homeHref = "/",
  reloadHref = ".",
}: ErrorPageProps) {
  return (
    <PageWrapper>
      <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
        <p className="text-sm text-slate-400 mb-6">Sorry, we couldn't load this page right now.</p>

        <div className="space-y-2 mb-6 text-xs text-slate-500 break-words">
          <p className="font-semibold text-slate-200">{error?.name ?? "Error"}</p>
          <p>{error?.message ?? "Unknown error"}</p>
        </div>

        {!isProduction && error?.stack ? (
          <details className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left text-xs text-slate-300">
            <summary className="cursor-pointer font-semibold text-slate-100">Show stack trace</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-5">{error.stack}</pre>
          </details>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={homeHref}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white text-center hover:bg-white/10 transition"
          >
            Go home
          </Link>
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/10 transition"
            >
              Reload page
            </button>
          ) : (
            <a
              href={reloadHref}
              className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white text-center hover:bg-white/10 transition"
            >
              Reload page
            </a>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
