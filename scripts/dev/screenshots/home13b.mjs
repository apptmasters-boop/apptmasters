// One-off for Sprint 13b: Home's pickers open and "Based on your last search".
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const OUT = new URL("./out13b/", import.meta.url);
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
const go = async p => {
  await page.goto(`http://localhost:3100${p}`, { waitUntil: "networkidle2" });
  if (p === "/") await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent.includes("Price")), { timeout: 60_000 });
};
const click = async text => {
  const ok = await page.evaluate(t => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(t)); if (b) b.click(); return !!b; }, text);
  if (!ok) console.log("NOT FOUND", text);
};

await go("/login");
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await go("/"); await shot("home-m");
await click("Price"); await shot("home-price-m");
await click("$2,000"); await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});
console.log("after price:", page.url());
await go("/"); await click("Bedrooms"); await shot("home-beds-m");
await go("/"); await click("Move-in date"); await shot("home-movein-m");
await go("/listings?q=Brooklyn&maxPrice=2000"); await go("/"); await shot("home-last-search-m");
await page.screenshot({ path: fileURLToPath(new URL("home-last-search-full-m.png", OUT)), fullPage: true });
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await page.evaluate(() => sessionStorage.clear());
await go("/"); await shot("home-d");
await click("Price"); await shot("home-price-d");
await browser.close();
