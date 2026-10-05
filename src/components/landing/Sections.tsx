import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon, UsersIcon, HeartHandIcon, HomeIcon, SproutIcon, ShieldCheckIcon,
  ClipboardCheckIcon, MessageIcon, FlagIcon, MailCheckIcon,
} from "./icons";

export function SectionHeading({ title, subtitle, link }: { title: string; subtitle: string; link?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-[28px]">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      </div>
      {link && (
        <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {link.label}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

type Icon = ComponentType<{ className?: string }>;

const COMMUNITY: { title: string; body: string; icon: Icon; tile: string; card: string }[] = [
  {
    title: "Build Friendships", icon: UsersIcon,
    body: "Connect with people from your community and make lasting friendships.",
    tile: "bg-emerald-600", card: "bg-emerald-50/60 dark:bg-emerald-950/30",
  },
  {
    title: "Get Mentorship", icon: HeartHandIcon,
    body: "Learn from experienced community members about housing, finances, and more.",
    tile: "bg-violet-400", card: "bg-violet-50/60 dark:bg-violet-950/30",
  },
  {
    title: "Find Support", icon: HomeIcon,
    body: "Get help with shared expenses, house rules, and any challenges that come up.",
    tile: "bg-amber-400", card: "bg-amber-50/60 dark:bg-amber-950/30",
  },
  {
    title: "Grow Your Future", icon: SproutIcon,
    body: "Build your rental history, save money, and work toward your own place.",
    tile: "bg-blue-500", card: "bg-sky-50/60 dark:bg-sky-950/30",
  },
];

export function CommunityCards() {
  return (
    <section>
      <SectionHeading
        title="More Than Just a Place"
        subtitle="You're not just finding a room. You're joining a community."
        link={{ href: "/signup", label: "Join the community" }}
      />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {COMMUNITY.map(({ title, body, icon: Icon, tile, card }) => (
          <div key={title} className={`flex flex-col rounded-2xl border border-gray-100 p-5 ${card}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${tile}`}>
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SafetyItem({ icon: Icon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-gray-700">
      <Icon className="h-4 w-4 shrink-0 text-brand dark:text-emerald-300" />
      {children}
    </li>
  );
}

// Every item here maps to something the app actually does today.
export function SafetySection() {
  return (
    <section className="grid gap-6 rounded-2xl border border-gray-200 bg-brand-soft/60 p-6 dark:bg-emerald-950/20 md:grid-cols-[1fr_auto] md:gap-10 md:p-8">
      <div className="flex gap-4">
        <ShieldCheckIcon className="h-8 w-8 shrink-0 text-brand dark:text-emerald-300" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand dark:text-emerald-300">Safety is not negotiable</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">Your safety, our priority.</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">
            Every listing is reviewed by our team before it goes live. You can message people right in the app
            without sharing your phone number, and report anything that doesn&apos;t look right.
          </p>
        </div>
      </div>
      <ul className="grid content-center gap-3 border-t border-gray-200 pt-5 sm:grid-cols-2 md:grid-cols-1 md:border-l md:border-t-0 md:pl-10 md:pt-0">
        <SafetyItem icon={ClipboardCheckIcon}>Listings reviewed before publishing</SafetyItem>
        <SafetyItem icon={MessageIcon}>Private in-app messaging</SafetyItem>
        <SafetyItem icon={FlagIcon}>Report any listing</SafetyItem>
        <SafetyItem icon={MailCheckIcon}>Two-factor sign-in available</SafetyItem>
      </ul>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="bg-brand-dark text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6 md:flex-row md:justify-between md:text-left lg:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Ready to find your next home?</p>
          <h2 className="mt-1.5 text-xl font-semibold md:text-2xl">Join a community that feels like home.</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/listings" className="inline-flex items-center gap-2 rounded-full bg-[#ffffff] px-6 py-2.5 text-sm font-semibold text-brand-dark hover:bg-white/90">
            Find a Home
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href="/listings/new" className="inline-flex items-center rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            List your space
          </Link>
        </div>
      </div>
    </section>
  );
}
