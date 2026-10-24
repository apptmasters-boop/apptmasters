/**
 * Translations (T1–T6, owner 2026-10-23): every English message exists in French,
 * Spanish and Arabic with the same placeholders ({email}) and tags (<strong>), and
 * the language is picked from the cookie, then the browser's language, then English.
 */
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import es from "../messages/es.json";
import ar from "../messages/ar.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** The {placeholders} and <tags> a message needs filled in. */
const slots = (message: string) =>
  [...new Set([...message.matchAll(/\{(\w+)/g)].map(m => `{${m[1]}}`).concat([...message.matchAll(/<(\w+)>/g)].map(m => `<${m[1]}>`)))].sort();

const english = flatten(en as Tree);

describe.each([["fr", fr], ["es", es], ["ar", ar]] as const)("messages/%s.json", (_name, messages) => {
  const translated = flatten(messages as Tree);

  it("has every English message, and nothing else", () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("keeps the same placeholders and tags", () => {
    for (const [key, text] of english) expect([key, slots(translated.get(key) ?? "")]).toEqual([key, slots(text)]);
  });

  it("has no empty message", () => {
    for (const [key, text] of translated) expect([key, text.trim().length > 0]).toEqual([key, true]);
  });
});

describe("choosing the language", () => {
  async function locales(switchedOn: string) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_LANGUAGES", switchedOn);
    const mod = await import("@/i18n/locales");
    vi.unstubAllEnvs();
    return mod;
  }

  it("follows the cookie first, then the browser, then English", async () => {
    const { pickLocale } = await locales("en,fr,es,ar");
    expect(pickLocale("ar", "fr-FR,fr;q=0.9")).toBe("ar");
    expect(pickLocale(undefined, "fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(pickLocale(undefined, "de-DE,es;q=0.7,en;q=0.5")).toBe("es");
    expect(pickLocale(undefined, "en;q=0.3,ar;q=0.9")).toBe("ar");
    expect(pickLocale("xx", "de-DE")).toBe("en");
    expect(pickLocale(undefined, undefined)).toBe("en");
  });

  it("stays English while only English is switched on (the live site until launch)", async () => {
    const { pickLocale, LOCALES } = await locales("en");
    expect(LOCALES).toEqual(["en"]);
    expect(pickLocale("fr", "ar")).toBe("en");
  });

  it("reads Arabic right to left, with the digits 0–9", async () => {
    const { dirOf, intlLocale } = await locales("en,fr,es,ar");
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
    expect(new Intl.NumberFormat(intlLocale("ar")).format(1200)).toMatch(/1.?200/);
  });
});
