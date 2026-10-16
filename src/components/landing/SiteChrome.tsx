import Link from "next/link";

/** The ApptMasters wordmark (house and name), as in the owner's designs (docs/mockups/). */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ApptMasters home">
      <svg className="h-8 w-8 text-brand" viewBox="0 0 32 32" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round">
        <path d="M4 14.5 16 4l12 10.5" /><path d="M7.5 12v15h17V12" /><path d="M13 27v-7h6v7" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">ApptMasters</span>
    </Link>
  );
}
