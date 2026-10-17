// Fixes F7 and F10: the signed-out Home search is one Location box and Search; every filter is on the results.
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

await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForSelector("#lp-city");
const extra = await page.evaluate(() => {
  const form = document.querySelector("#lp-city").closest("form");
  return { radios: form.querySelectorAll("[role=radio]").length, selects: form.querySelectorAll("select").length, inputs: form.querySelectorAll("input").length };
});
ok(extra.radios === 0 && extra.selects === 0 && extra.inputs === 1, `only the Location box (${JSON.stringify(extra)})`);

await page.type("#lp-city", "Brooklyn"); await page.keyboard.press("Enter"); await wait(2000);
let u = new URL(page.url());
ok(u.pathname === "/listings" && u.search === "?q=Brooklyn", `Brooklyn + Enter: ${u.pathname}${u.search}`);

await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.evaluate(() => [...document.querySelectorAll("button[type=submit]")].find(b => b.textContent.trim() === "Search")?.click());
await wait(2000);
u = new URL(page.url());
ok(u.pathname === "/listings" && u.search === "", `empty Search opens all listings: ${u.pathname}${u.search}`);

await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.screenshot({ path: fileURLToPath(new URL("home-d.png", OUT)), clip: { x: 0, y: 300, width: 1536, height: 360 } });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.evaluate(() => window.scrollTo(0, 200)); await wait(500);
await page.screenshot({ path: fileURLToPath(new URL("home-m.png", OUT)) });
await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL HOME SEARCH CHECKS PASSED");
process.exit(failures ? 1 : 0);
