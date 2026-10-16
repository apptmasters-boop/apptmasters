import Link from "next/link";
import { SearchIcon, MessageIcon, HomeIcon, UsersIcon, ArrowRightIcon } from "@/components/landing/icons";

export const metadata = { title: "How It Works · ApptMasters" };

/** How It Works (Sprint 12; MARKETPLACE_FLOW.md §20): simple and educational. */
const STEPS = [
  { icon: SearchIcon, title: "Find", text: "Search apartments, rooms and shared housing. Filter by price, how many people will live there, and what matters to you. No account needed to look." },
  { icon: MessageIcon, title: "Connect", text: "Contact the advertiser from the listing. Your conversation stays tied to that listing, and the exact address is shared there when they choose." },
  { icon: HomeIcon, title: "Move in", text: "Visit, then complete the lease and payment arrangements with the advertiser, outside ApptMasters. Never pay before you've seen the place." },
  { icon: UsersIcon, title: "Manage together", text: "Once you have a place, create or join a Home: share rent and expenses, cleaning and shopping turns, chat and more with your roommates." },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:pt-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">How It Works</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">From finding a place to living well together</h1>
      <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">ApptMasters helps you find a home, then makes sharing it simple.</p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="relative rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <span className="absolute right-5 top-5 text-4xl font-bold text-gray-100 dark:text-gray-800" aria-hidden>{i + 1}</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200"><Icon className="h-6 w-6" /></span>
            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{i + 1}. {title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/listings" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white hover:bg-brand-dark">
          Find a Home<ArrowRightIcon className="h-5 w-5" />
        </Link>
        <Link href="/apartment/create" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          I already have a place
        </Link>
      </div>
    </main>
  );
}
