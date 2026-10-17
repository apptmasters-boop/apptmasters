// Fix F8: the Price button opens the price range (results, computer and phone; signed-in Home).
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const OUT = new URL("./outF8/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
const click = t => page.evaluate(t => [...document.querySelectorAll("button")].find(b => b.offsetParent && b.textContent.trim().startsWith(t))?.click(), t);
const shot = async (n, clip) => { await new Promise(r => setTimeout(r, 900)); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), clip }); console.log("shot", n); };
await page.setViewport({ width: 1536, height: 900 });
await page.goto("http://localhost:3100/listings", { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0);
await click("Any price"); await shot("price-d", { x: 0, y: 60, width: 1000, height: 520 });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto("http://localhost:3100/listings", { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0);
await click("Any price"); await shot("price-m");
// Signed in: Home's Price button.
await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.type("input[type=email]", "owner@apptmasters.local"); await page.type("input[type=password]", "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim().startsWith("Price")));
await click("Price"); await page.evaluate(() => document.querySelector("#quick-picker")?.scrollIntoView({ block: "center" })); await shot("home-price-m");
await browser.close();
