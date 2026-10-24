/**
 * The languages ApptMasters speaks (translation project T1–T6, owner 2026-10-23:
 * "make sure that the user have an option to change language because we have
 * people that doesn't speak English"). No /fr/ addresses: the language is a
 * cookie, set by the language button; on a first visit, the phone's or
 * browser's language. Shared by the server (src/i18n/request.ts) and the browser.
 */
export const ALL_LOCALES = ["en", "fr", "es", "ar"] as const;
export type Locale = (typeof ALL_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (ALL_LOCALES as readonly string[]).includes(v);

/**
 * The languages switched on. All four on this PC (`next dev`); English only on the
 * live site until the whole site is translated and reviewed (the owner's choice),
 * unless NEXT_PUBLIC_LANGUAGES says otherwise. Launch = make the default all four.
 */
const switchedOn = (process.env.NEXT_PUBLIC_LANGUAGES ?? (process.env.NODE_ENV === "development" ? "en,fr,es,ar" : "en"))
  .split(",").map(s => s.trim());
export const LOCALES: Locale[] = ALL_LOCALES.filter(l => l === DEFAULT_LOCALE || switchedOn.includes(l));

/** Each language in its own words, so a person who doesn't read English still finds theirs. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", fr: "Français", es: "Español", ar: "العربية" };
/** On the language button. */
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", fr: "FR", es: "ES", ar: "ع" };

export const isRtl = (locale: Locale) => locale === "ar";
export const dirOf = (locale: Locale) => (isRtl(locale) ? "rtl" : "ltr");

/** Remembered on the device for a year. */
export const LOCALE_COOKIE = "am_lang";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** For dates and numbers: Arabic keeps the digits 0–9, like the prices and addresses. */
export const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-u-nu-latn" : locale === "en" ? "en-US" : locale);

/** The best switched-on language in an Accept-Language header ("fr-CA,fr;q=0.9,en;q=0.8"). */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const wanted = header.split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter(w => w.lang && w.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lang } of wanted) {
    if (isLocale(lang) && LOCALES.includes(lang)) return lang;
  }
  return null;
}

/** The chosen language (cookie), else the browser's, else English. */
export function pickLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie) && LOCALES.includes(cookie)) return cookie;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
