// Fix F7: the signed-out Home search: All / Rooms / Whole places + one Location box.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const OUT = new URL("./outF7/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" }); await page.evaluate(() => localStorage.clear());
await page.setViewport({ width: 1536, height: 1000 });

async function homeSearch(choice, text) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await page.waitForSelector("#lp-city");
  if (choice) await page.evaluate(t => [...document.querySelectorAll("[role=radio]")].find(b => b.textContent.trim() === t)?.click(), choice);
  if (text) { await page.type("#lp-city", text); await page.keyboard.press("Enter"); }
  else await page.evaluate(() => [...document.querySelectorAll("button[type=submit]")].find(b => b.textContent.trim() === "Search")?.click());
  await wait(2000);
  return new URL(page.url());
}
ok(!(await page.goto(`${BASE}/`, { waitUntil: "networkidle2" }).then(() => page.$("#lp-people, #lp-budget, #lp-type"))), "no People, budget or Looking-for fields");
let u = await homeSearch("Rooms", "Brooklyn");
ok(u.searchParams.get("q") === "Brooklyn" && u.searchParams.get("kind") === "room", `Rooms + Brooklyn: ${u.search}`);
ok(await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find(t => t.getAttribute("aria-selected") === "true")?.textContent.startsWith("Rooms")), "the Rooms tab is active");
const types = await page.evaluate(() => [...document.querySelectorAll("article")].filter(a => a.offsetParent).map(a => a.innerText));
ok(types.length > 0 && types.every(t => /room/i.test(t)), `only rooms (${types.length} cards)`);
u = await homeSearch("Whole places", "");
ok(u.searchParams.get("type") === "APARTMENT_FOR_RENT" && !u.searchParams.get("q"), `Whole places: ${u.search}`);
ok(!!(await page.$("button[aria-label='Remove Whole places']")), "a removable Whole places chip shows");
u = await homeSearch("", "11216");
ok(u.searchParams.get("q") === "11216" && !u.searchParams.get("kind") && !u.searchParams.get("type"), `All + ZIP + Enter: ${u.search}`);

await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.screenshot({ path: fileURLToPath(new URL("home-d.png", OUT)), clip: { x: 0, y: 300, width: 1536, height: 420 } });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.evaluate(() => window.scrollTo(0, 200)); await wait(500);
await page.screenshot({ path: fileURLToPath(new URL("home-m.png", OUT)) });
await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F7 CHECKS PASSED");
process.exit(failures ? 1 : 0);
