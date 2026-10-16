import Link from "next/link";

export const metadata = { title: "Help · ApptMasters" };

/** Help (Sprint 12; MARKETPLACE_FLOW.md §21): short answers to the common questions. */
const QUESTIONS: [string, React.ReactNode][] = [
  ["Do I need an account to search?", "No. Anyone can search and open listings. An account is only needed to save listings, message advertisers, post a listing, or create or join a home."],
  ["How do I save a listing?", <>Tap the heart on a listing. Your saved listings are in <Link href="/saved" className="font-semibold text-brand hover:underline">Saved</Link>, and stay there (labeled) even if a listing is no longer available.</>],
  ["How do I contact an advertiser?", "Open the listing and tap Contact. The conversation stays tied to that listing. Contacting someone isn't an application: you agree on a visit, the lease and payment with them directly."],
  ["Why can't I see the exact address?", "For the advertiser's privacy, listings show the neighborhood and city. They share the exact address in your conversation when they're ready."],
  ["What does \"Up to 4 people\" mean?", "How many people can live in the place, as the advertiser declares it. When you search for a number of occupants, only listings that state at least that many show up."],
  ["I found a place. What now?", <><Link href="/apartment/create" className="font-semibold text-brand hover:underline">Create a Home</Link> to share rent, expenses, cleaning and shopping with your roommates, or <Link href="/apartment/join" className="font-semibold text-brand hover:underline">join one</Link> with the invite code a roommate gave you.</>],
  ["How do I stay safe?", "Visit before you pay anything, never send money to someone you haven't met, and keep your conversations on ApptMasters. If something feels wrong, use \"Report this listing\" on the listing."],
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Help</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">Answers to the questions people ask most.</p>
      <div className="mt-6 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        {QUESTIONS.map(([q, a]) => (
          <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900 dark:text-white">
              {q}<span className="text-xl text-gray-400 transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
