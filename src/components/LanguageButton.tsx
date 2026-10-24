"use client";
/**
 * The language button (translation T1, owner 2026-10-23: "make sure that the user
 * have an option to change language because we have people that doesn't speak
 * English"): a globe with the current language (EN, FR, ES, ع); its menu lists each
 * language in its own words. Hidden while only English is switched on (the live site
 * until launch; src/i18n/locales.ts).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, LOCALE_SHORT, dirOf, type Locale } from "@/i18n/locales";
import { CheckIcon, GlobeIcon } from "@/components/landing/icons";

/** More than English is switched on: show the button and the Language rows. */
export const languagesOn = LOCALES.length > 1;

/** Changes the language: remembered on this device, and the page redrawn in it. */
export function useSetLanguage() {
  const router = useRouter();
  return (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
    router.refresh();
  };
}

export default function LanguageButton({ className = "" }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const setLanguage = useSetLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!languagesOn) return null;
  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"
        aria-label={`${t("button")}: ${LOCALE_NAMES[locale]}`} data-language-button
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
        <GlobeIcon className="h-[18px] w-[18px]" />
        <span>{LOCALE_SHORT[locale]}</span>
      </button>
      {open && (
        <ul role="menu" aria-label={t("button")}
          className="absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {LOCALES.map(l => (
            <li key={l} role="none">
              <button type="button" role="menuitemradio" aria-checked={l === locale}
                onClick={() => { setOpen(false); if (l !== locale) setLanguage(l); }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[15px] text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800">
                <span lang={l} dir="auto">{LOCALE_NAMES[l]}</span>
                {l === locale && <CheckIcon className="h-4 w-4 text-brand dark:text-emerald-300" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
