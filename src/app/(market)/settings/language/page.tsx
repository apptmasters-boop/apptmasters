"use client";
/**
 * Language (translation T1): the same choice as the 🌐 button, as a page, reached from
 * More and Settings. Open to everyone: a visitor who doesn't read English needs it most.
 */
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_NAMES } from "@/i18n/locales";
import { useSetLanguage } from "@/components/LanguageButton";
import { useMe } from "@/components/market/useMe";
import { PageTitle, pageWidth } from "@/components/market/SettingsList";
import { CheckIcon } from "@/components/landing/icons";

export default function LanguagePage() {
  const t = useTranslations("language");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const me = useMe();
  const setLanguage = useSetLanguage();

  return (
    <main className={pageWidth}>
      <PageTitle back={me ? { href: "/settings", label: nav("settings") } : { href: "/more", label: nav("more") }}
        title={t("title")} subtitle={t("subtitle")} />
      <div role="radiogroup" aria-label={t("title")}
        className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        {LOCALES.map(l => (
          <button key={l} type="button" role="radio" aria-checked={l === locale} onClick={() => { if (l !== locale) setLanguage(l); }}
            className="flex w-full items-center gap-4 px-4 py-4 text-start hover:bg-gray-50 dark:hover:bg-gray-800/60">
            <span lang={l} dir="auto" className="flex-1 text-[17px] text-gray-900 dark:text-white">{LOCALE_NAMES[l]}</span>
            {l === locale && <CheckIcon className="h-5 w-5 text-brand dark:text-emerald-300" />}
          </button>
        ))}
      </div>
      <p className="mt-4 px-1 text-sm text-gray-500 dark:text-gray-400">{t("note")}</p>
    </main>
  );
}
