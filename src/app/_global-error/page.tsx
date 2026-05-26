export const dynamic = "force-dynamic";

import Link from "next/link";

interface Props {
  error: Error;
}

export default function GlobalErrorPage({ error }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-4">
      <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-black/20">
        <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
        <p className="text-sm text-slate-400 mb-6">An unexpected error occurred while loading the page.</p>
        <p className="text-xs text-slate-500 mb-6 break-words">{error?.message ?? "Unknown error"}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white text-center hover:bg-white/10 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
