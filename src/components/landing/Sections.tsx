import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon, ShieldCheckIcon, ClipboardCheckIcon, MessageIcon, FlagIcon, MailCheckIcon,
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
  const t = useTranslations("landing");
  return (
    <section className="grid gap-6 rounded-2xl border border-gray-200 bg-brand-soft/60 p-6 dark:bg-emerald-950/20 md:grid-cols-[1fr_auto] md:gap-10 md:p-8">
      <div className="flex gap-4">
        <ShieldCheckIcon className="h-8 w-8 shrink-0 text-brand dark:text-emerald-300" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand dark:text-emerald-300">{t("safetyEyebrow")}</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">{t("safetyTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">{t("safetyText")}</p>
        </div>
      </div>
      <ul className="grid content-center gap-3 border-t border-gray-200 pt-5 sm:grid-cols-2 md:grid-cols-1 md:border-s md:border-t-0 md:ps-10 md:pt-0">
        <SafetyItem icon={ClipboardCheckIcon}>{t("safetyReviewed")}</SafetyItem>
        <SafetyItem icon={MessageIcon}>{t("safetyMessaging")}</SafetyItem>
        <SafetyItem icon={FlagIcon}>{t("safetyReport")}</SafetyItem>
        <SafetyItem icon={MailCheckIcon}>{t("safetyTwoFactor")}</SafetyItem>
      </ul>
    </section>
  );
}

export function CtaBand() {
  const t = useTranslations("landing");
  return (
    <section className="bg-brand-dark text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6 md:flex-row md:justify-between md:text-start lg:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{t("ctaEyebrow")}</p>
          <h2 className="mt-1.5 text-xl font-semibold md:text-2xl">{t("ctaTitle")}</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/listings" className="inline-flex items-center gap-2 rounded-full bg-[#ffffff] px-6 py-2.5 text-sm font-semibold text-brand-dark hover:bg-white/90">
            {t("ctaFind")}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href="/listings/new" className="inline-flex items-center rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            {t("ctaList")}
          </Link>
        </div>
      </div>
    </section>
  );
}
