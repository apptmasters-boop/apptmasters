// Translation T1 (owner, 2026-10-23): the language button, the first visit in the browser's
// language, Arabic right to left, and the T1 pages in French, Spanish and Arabic with no
// English left. Local copy only (all four languages are switched on in `next dev`).
//   node i18n-check.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: the live site has English only until launch");
const PROJECT = new URL("../../../", import.meta.url);
const OUT = new URL("./outI18n/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

// The messages, and the English texts a translated page must no longer show.
const load = l => JSON.parse(fs.readFileSync(new URL(`messages/${l}.json`, PROJECT), "utf8"));
const flat = (tree, p = "") => Object.entries(tree).flatMap(([k, v]) => typeof v === "string" ? [[p + k, v]] : flat(v, `${p}${k}.`));
const msgs = Object.fromEntries(["en", "fr", "es", "ar"].map(l => [l, Object.fromEntries(flat(load(l)))]));
const T1 = /^(meta|common|language|nav|home|homeQuestion|landing|auth|intent|more|settings|bell|error)\./;
const englishLeft = l => [...new Set(Object.entries(msgs.en)
  .filter(([k, v]) => T1.test(k) && msgs[l][k] !== v && !/[{<]/.test(v))
  .map(([, v]) => v))];
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2 };
const COMPUTER = { width: 1536, height: 1000 };

const login = async email => (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "LocalTest-2026" }) })).json()).token;
const seeker = await login("owner@apptmasters.local");
const resident = await login("resident@apptmasters.local");
ok(!!seeker && !!resident, "the local logins work (owner, resident)");
const homeId = (await (await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${resident}` } })).json())
  .memberships?.find(m => m.status === "ACTIVE")?.apartment?.id;
ok(!!homeId, "the resident has a Home");

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });

/** A fresh visitor (no cookie, no sign-in), optionally with a browser language. */
async function freshPage(acceptLanguage, viewport = PHONE) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(180_000);
  page.setDefaultTimeout(60_000);
  await page.setViewport(viewport);
  if (acceptLanguage) await page.setExtraHTTPHeaders({ "Accept-Language": acceptLanguage });
  page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
  page.on("console", m => { if (/MISSING_MESSAGE|IntlError|INVALID_MESSAGE|FORMATTING_ERROR/.test(m.text())) { console.log("INTL", m.text().slice(0, 200)); failures++; } });
  return page;
}
async function as(page, locale, token) {
  await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
  await page.setCookie({ name: "am_lang", value: locale, url: BASE });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); if (t) localStorage.setItem("token", t); }, token ?? null);
}
const htmlLang = page => page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
async function settle(page) {
  await page.waitForFunction(() => !document.body.innerText.match(/^\s*(Loading…|Chargement…|Cargando…|جارٍ التحميل…)\s*$/), { timeout: 60_000 }).catch(() => {});
  await wait(900);
}

/** Visible English (from T1 messages) left on a translated page: text, placeholders and labels. */
async function leftovers(page, locale) {
  return page.evaluate(english => {
    const set = new Set(english);
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0;
    const found = new Set();
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || ["SCRIPT", "STYLE"].includes(el.tagName)) continue;
      const text = el.innerText?.trim().replace(/\s+/g, " ");
      if (text && set.has(text)) found.add(text);
      for (const a of ["placeholder", "aria-label", "alt"]) { const v = el.getAttribute(a); if (v && set.has(v)) found.add(`${a}: ${v}`); }
    }
    return [...found];
  }, englishLeft(locale));
}
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const languageButton = page => page.$("[data-language-button]");

// 1. The first visit follows the browser's language.
for (const [header, want] of [["fr-FR,fr;q=0.9,en;q=0.8", "fr"], ["es-US,es;q=0.9", "es"], ["ar-EG,ar;q=0.9", "ar"], ["de-DE,de;q=0.9", "en"]]) {
  const page = await freshPage(header);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await settle(page);
  const [lang, dir] = await htmlLang(page);
  const h1 = await page.$eval("h1", h => h.textContent.trim()).catch(() => "");
  ok(lang === want && dir === (want === "ar" ? "rtl" : "ltr") && h1 === msgs[want]["home.heroTitle"], `first visit with ${header.split(",")[0]}: ${lang}/${dir}, "${h1}"`);
  await page.browserContext().close();
}

// 2. The button: pressing it and choosing a language switches the page and remembers it.
{
  const page = await freshPage("en-US,en;q=0.9");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await settle(page);
  ok(!!(await languageButton(page)), "Home on a phone: the 🌐 button is in the top bar");
  ok((await page.$eval("[data-language-button]", b => b.textContent.trim()).catch(() => "")) === "EN", "it says EN");
  await page.click("[data-language-button]");
  const names = await page.$$eval("[role=menuitemradio]", bs => bs.map(b => b.textContent.trim()));
  ok(JSON.stringify(names) === JSON.stringify(["English", "Français", "Español", "العربية"]), `the languages in their own words: ${names.join(" · ")}`);
  await page.evaluate(() => [...document.querySelectorAll("[role=menuitemradio]")].find(b => b.textContent.trim() === "Español")?.click());
  await page.waitForFunction(t => document.querySelector("h1")?.textContent.trim() === t, { timeout: 30_000 }, msgs.es["home.heroTitle"]).catch(() => {});
  ok((await htmlLang(page))[0] === "es", "choosing Español: the page is in Spanish");
  ok((await page.cookies()).some(c => c.name === "am_lang" && c.value === "es"), "and it is remembered (cookie am_lang=es)");
  await page.reload({ waitUntil: "networkidle2" });
  await settle(page);
  ok((await htmlLang(page))[0] === "es", "still Spanish after reloading");
  await page.click("[data-language-button]");
  await page.evaluate(() => [...document.querySelectorAll("[role=menuitemradio]")].find(b => b.textContent.trim() === "العربية")?.click());
  await page.waitForFunction(() => document.documentElement.dir === "rtl", { timeout: 30_000 }).catch(() => {});
  ok(JSON.stringify(await htmlLang(page)) === JSON.stringify(["ar", "rtl"]), "choosing العربية: Arabic, right to left");
  await page.browserContext().close();
}

// 3. Each T1 page in each language: lang/dir, no English left, no sideways scrolling, the button where it belongs.
const PAGES = [
  { path: "/", who: null, button: true, shots: true },
  { path: "/login", who: null, button: true, shots: true },
  { path: "/signup", who: null, button: true, shots: true },
  { path: "/forgot-password", who: null, button: true },
  { path: "/reset-password", who: null, button: true },
  { path: "/verify-email", who: null, button: true },
  { path: "/more", who: null, shots: true },
  { path: "/settings/language", who: null },
  { path: "/", who: "seeker", button: true, shots: true, name: "home-signed-in" },
  { path: "/more", who: "seeker", name: "more-signed-in" },
  { path: "/settings", who: "seeker" },
];
for (const locale of ["fr", "es", "ar"]) {
  console.log(`\n--- ${locale} ---`);
  for (const [size, viewport] of [["phone", PHONE], ["computer", COMPUTER]]) {
    const page = await freshPage(null, viewport);
    for (const { path, who, button, shots, name } of PAGES) {
      const label = `${size} ${path}${who ? " (signed in)" : ""}`;
      await as(page, locale, who === "seeker" ? seeker : null);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
      await settle(page);
      const [lang, dir] = await htmlLang(page);
      ok(lang === locale && dir === (locale === "ar" ? "rtl" : "ltr"), `${label}: ${lang}/${dir}`);
      const left = await leftovers(page, locale);
      ok(left.length === 0, `${label}: no English left${left.length ? ` (${left.slice(0, 6).join(" | ")})` : ""}`);
      ok(await noSideScroll(page), `${label}: no sideways scrolling`);
      if (button) ok(!!(await languageButton(page)), `${label}: the 🌐 button is there`);
      if (shots) {
        const file = `${locale}-${name ?? (path === "/" ? "home" : path.slice(1).replace(/\//g, "-"))}-${size}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(file, OUT)) });
      }
    }
    // The Language row on More (phones reach the language from every page this way).
    if (size === "phone") {
      await as(page, locale, null);
      await page.goto(`${BASE}/more`, { waitUntil: "networkidle2" });
      await settle(page);
      ok(await page.evaluate(n => [...document.querySelectorAll("a[href='/settings/language']")].some(a => a.innerText.includes(n)), msgs[locale]["language.title"]),
        `${label(locale)} More: a "${msgs[locale]["language.title"]}" row`);
    }
    // Arabic mirrors: the logo on the right, the household side menu on the right.
    if (locale === "ar" && size === "computer") {
      await as(page, locale, null);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
      await settle(page);
      const logoX = await page.$eval("header a[href='/']", a => a.getBoundingClientRect().left);
      ok(logoX > 1536 / 2, `Arabic: the logo is on the right (x=${Math.round(logoX)})`);
      await as(page, locale, resident);
      await page.goto(`${BASE}/apartment/${homeId}/more`, { waitUntil: "networkidle2" });
      await settle(page);
      const asideX = await page.$eval("aside", a => a.getBoundingClientRect().left).catch(() => -1);
      ok(asideX > 1536 / 2, `Arabic: the household side menu is on the right (x=${Math.round(asideX)})`);
      ok(!!(await page.$("aside [data-language-button]")), "the household side menu has the 🌐 button");
      const tabs = await page.$$eval("aside nav a", as => as.map(a => a.innerText.trim()));
      ok(JSON.stringify(tabs) === JSON.stringify(["home", "household", "money", "chat", "more"].map(k => msgs.ar[`nav.${k}`])), `the side menu in Arabic: ${tabs.join(" · ")}`);
      await page.screenshot({ path: fileURLToPath(new URL("ar-household-computer.png", OUT)) });
    }
    await page.browserContext().close();
  }
}
function label(l) { return `phone (${l})`; }

// 4. English is unchanged.
{
  const page = await freshPage(null, COMPUTER);
  await as(page, "en", null);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await settle(page);
  ok(JSON.stringify(await htmlLang(page)) === JSON.stringify(["en", "ltr"]), "English: en/ltr");
  ok((await page.$eval("h1", h => h.textContent.trim())) === "Find a safe place with people you can trust.", "English: the Home title as before");
  const logoX = await page.$eval("header a[href='/']", a => a.getBoundingClientRect().left);
  ok(logoX < 1536 / 2, "English: the logo on the left");
  await page.screenshot({ path: fileURLToPath(new URL("en-home-computer.png", OUT)) });
  await page.browserContext().close();
}

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL I18N CHECKS PASSED");
process.exit(failures ? 1 : 0);
