// One-off for Sprint 13c: results on phone (with a picker open) and desktop (grid and list).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const OUT = new URL("./out13c/", import.meta.url);
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
const go = async p => {
  await page.goto(`http://localhost:3100${p}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.querySelectorAll("article").length > 0 || document.body.innerText.includes("No listings match"), { timeout: 90_000 });
};
const click = async text => {
  const ok = await page.evaluate(t => { const b = [...document.querySelectorAll("button")].find(x => x.offsetParent && x.textContent.trim().startsWith(t)); if (b) b.click(); return !!b; }, text);
  if (!ok) console.log("NOT FOUND", text);
};

await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await go("/listings?q=Brooklyn"); await shot("results-m"); await shot("results-full-m", true);
await click("Any price"); await shot("results-price-picker-m");
await click("$2,000"); await new Promise(r => setTimeout(r, 1500)); console.log("after pick:", page.url()); await shot("results-priced-m");
await go("/listings?q=Brooklyn&kind=room"); await shot("results-rooms-m");
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await go("/listings?q=Brooklyn&occupants=2"); await shot("results-d");
await click("List"); await shot("results-list-d");
await click("Grid");
await browser.close();
