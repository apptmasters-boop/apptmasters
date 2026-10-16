// One-off for Sprint 13d: the phone Filters sheet, the desktop filter panel, the listing form.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const OUT = new URL("./out13d/", import.meta.url);
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
const wait = text => page.waitForFunction(t => document.body.innerText.includes(t), { timeout: 90_000 }, text);
const click = async text => {
  const ok = await page.evaluate(t => { const b = [...document.querySelectorAll("button")].find(x => x.offsetParent && x.textContent.trim() === t); if (b) b.click(); return !!b; }, text);
  if (!ok) console.log("NOT FOUND", text);
};

await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto("http://localhost:3100/listings?q=Brooklyn&maxPrice=2500&minPrice=500&occupants=2&panel=1", { waitUntil: "networkidle2" });
await wait("Additional options"); await shot("filters-m");
await click("Room"); await shot("filters-room-m");
// Scroll the sheet to the options.
await page.evaluate(() => { const el = [...document.querySelectorAll("h3")].find(h => h.textContent === "Additional options"); el?.scrollIntoView({ block: "start" }); });
await shot("filters-options-m");
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await page.goto("http://localhost:3100/listings?q=Brooklyn&maxPrice=2500&amenities=furnished,internetIncluded", { waitUntil: "networkidle2" });
await wait("Apply filters"); await shot("filters-d");
await page.evaluate(() => { const el = [...document.querySelectorAll("aside h3")].find(h => h.textContent === "Amenities"); el?.scrollIntoView({ block: "start" }); });
await shot("filters-amenities-d");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto("http://localhost:3100/listings/new", { waitUntil: "networkidle2" });
await wait("Size (square feet)");
await page.evaluate(() => { const el = [...document.querySelectorAll("label")].find(l => l.textContent.startsWith("Size")); el?.scrollIntoView({ block: "center" }); });
await shot("form-size-m");
await browser.close();
