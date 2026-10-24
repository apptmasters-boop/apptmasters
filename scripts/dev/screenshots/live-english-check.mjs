// Translation, until launch (owner, 2026-10-23: hide the language choice on apptmasters.com until
// everything is translated): the live site stays English for everyone, with no language button,
// even for a French or Arabic browser or an am_lang cookie. Read-only.
//   SHOTS_BASE=https://apptmasters.com node live-english-check.mjs
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOTS_BASE ?? "https://apptmasters.com";
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });

for (const [header, cookie] of [["fr-FR,fr;q=0.9", null], ["ar-EG,ar;q=0.9", null], ["en-US,en;q=0.9", "es"]]) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.setExtraHTTPHeaders({ "Accept-Language": header });
  if (cookie) await page.setCookie({ name: "am_lang", value: cookie, url: BASE });
  for (const path of ["/", "/login", "/signup", "/more"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1200));
    const [lang, dir] = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
    const button = await page.$("[data-language-button]");
    const languageRow = await page.$("a[href='/settings/language']");
    ok(lang === "en" && dir === "ltr" && !button && !languageRow, `${header.split(",")[0]}${cookie ? ` + cookie ${cookie}` : ""} ${path}: ${lang}/${dir}, no language button or row`);
  }
  const h1 = await (await context.newPage().then(async p => { await p.setExtraHTTPHeaders({ "Accept-Language": header }); await p.goto(`${BASE}/`, { waitUntil: "networkidle2" }); return p; })).$eval("h1", h => h.textContent.trim()).catch(() => "");
  ok(h1 === "Find a safe place with people you can trust.", `Home title in English: "${h1}"`);
  await context.close();
}
await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL LIVE-ENGLISH CHECKS PASSED");
process.exit(failures ? 1 : 0);
