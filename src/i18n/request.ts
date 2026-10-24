/**
 * next-intl's per-request setup (no locale in the address): the language from the
 * am_lang cookie, else the browser's Accept-Language, else English. A message
 * missing from a translation shows in English rather than as its key.
 */
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, pickLocale, type Locale } from "./locales";

type Messages = { [key: string]: string | Messages };

const load = (locale: Locale): Promise<Messages> => import(`../../messages/${locale}.json`).then(m => m.default);

function withFallback(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const b = base[key];
    out[key] = typeof value === "object" && typeof b === "object" ? withFallback(b, value) : value;
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get("accept-language"));
  const english = await load(DEFAULT_LOCALE);
  return {
    locale,
    messages: locale === DEFAULT_LOCALE ? english : withFallback(english, await load(locale)),
    // ApptMasters is in New York; pages format dates in the reader's own time zone themselves.
    timeZone: "America/New_York",
  };
});
