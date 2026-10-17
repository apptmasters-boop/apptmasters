// Typing a ZIP code and pressing Enter, in each place a location can be typed.
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
await page.setViewport({ width: 1536, height: 1000 });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const report = async (label) => {
  await wait(2000);
  const u = new URL(page.url());
  const ok = u.pathname === "/listings" && u.searchParams.get("q") === "11216";
  const count = ok ? await page.evaluate(() => document.querySelectorAll("article").length) : 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${u.pathname}${u.search} ${ok ? `(${count} cards)` : ""}`);
  if (!ok) failures++;
};
async function signedOut() { await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" }); await page.evaluate(() => localStorage.clear()); }

// 1. Signed-out Home search panel.
await signedOut();
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.type("#lp-city", "11216"); await page.keyboard.press("Enter");
await report("signed-out Home search box");

// 2. Filters → Location on the results.
await page.goto(`${BASE}/listings`, { waitUntil: "networkidle2" });
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.offsetParent && b.textContent.trim().startsWith("Filters"))?.click());
await page.waitForSelector("[role=dialog] input[aria-label='Location']");
await page.type("[role=dialog] input[aria-label='Location']", "11216"); await page.keyboard.press("Enter");
await report("Filters → Location");
await page.keyboard.press("Escape");

// 3. Signed-in Home search box.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type("input[type=email]", "owner@apptmasters.local"); await page.type("input[type=password]", "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForSelector("input[aria-label='City, neighborhood, or ZIP code']");
await page.type("input[aria-label='City, neighborhood, or ZIP code']", "11216"); await page.keyboard.press("Enter");
await report("signed-in Home search box");

await browser.close();
console.log(failures ? `${failures} PLACE(S) WHERE ENTER DOESN'T SEARCH` : "ENTER SEARCHES EVERYWHERE");
process.exit(failures ? 1 : 0);
