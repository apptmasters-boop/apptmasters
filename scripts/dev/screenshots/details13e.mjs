// One-off for Sprint 13e: the listing page on phone (top and further down) and desktop.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const OUT = new URL("./out13e/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const token = jwt.sign({ userId: "shot-me", email: "shots-me@example.com" }, "shots-local-secret", { expiresIn: "1h" });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
  args: ["--no-sandbox", "--no-first-run", "--disable-gpu"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)),
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
const shot = async (name, fullPage = false) => { await new Promise(r => setTimeout(r, 1200)); await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)), fullPage }); console.log("shot", name); };
const open = async () => {
  await page.goto("http://localhost:3100/listings/shot-l1", { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.body.innerText.includes("Amenities"), { timeout: 90_000 });
};
const scrollTo = text => page.evaluate(t => { const el = [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === t); el?.scrollIntoView({ block: "start" }); window.scrollBy(0, -16); }, text);

await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await open(); await shot("details-m");
await scrollTo("Amenities"); await shot("details-amenities-m");
await scrollTo("Neighborhood"); await shot("details-neighborhood-m");
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await open(); await shot("details-d");
await scrollTo("Lease and fees"); await shot("details-scrolled-d");
await browser.close();
