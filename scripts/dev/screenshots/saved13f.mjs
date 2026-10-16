// One-off for Sprint 13f: Saved on phone (search, sort and card menus) and desktop (grid and list).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const OUT = new URL("./out13f/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const token = jwt.sign({ userId: "shot-me", email: "shots-me@example.com" }, "shots-local-secret", { expiresIn: "1h" });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
  args: ["--no-sandbox", "--no-first-run", "--disable-gpu"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)),
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
const shot = async name => { await new Promise(r => setTimeout(r, 1000)); await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) }); console.log("shot", name); };
const open = async () => {
  await page.goto("http://localhost:3100/saved", { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.querySelectorAll("article").length > 0, { timeout: 90_000 });
};
const clickLabel = label => page.evaluate(l => { const b = [...document.querySelectorAll("button")].find(x => x.offsetParent && x.getAttribute("aria-label") === l); b?.click(); return !!b; }, label);

await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await open(); await shot("saved-m");
await clickLabel("Search your saved listings"); await page.type("input[aria-label='Search your saved listings']", "Brooklyn"); await shot("saved-search-m");
await open(); await clickLabel("Sort saved listings"); await shot("saved-sort-m");
await open(); await clickLabel("More actions"); await shot("saved-card-menu-m");
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await page.evaluate(() => { try { localStorage.removeItem("am:savedView"); } catch {} });
await open(); await shot("saved-d");
await clickLabel("More actions"); await shot("saved-card-menu-d");
await open();
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "List"); b?.click(); });
await shot("saved-list-d");
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Grid"); b?.click(); });
await browser.close();
