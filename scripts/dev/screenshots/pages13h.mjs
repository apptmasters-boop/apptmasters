// Sprint 13h: More, How It Works, Help, Create a Home, Join a Home on phone (and More on desktop).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const [outName = "out13h"] = process.argv.slice(2);
const OUT = new URL(`./${outName}/`, import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const token = jwt.sign({ userId: "shot-me", email: "shots-me@example.com" }, "shots-local-secret", { expiresIn: "1h" });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
  args: ["--no-sandbox", "--no-first-run", "--disable-gpu"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)),
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
const shot = async (name, fullPage = false) => { await new Promise(r => setTimeout(r, 1500)); await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)), fullPage }); console.log("shot", name); };
const go = async (path, text) => {
  await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(t => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: 90_000 }, text);
};

await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await go("/more", "Housing"); await shot("more-m"); await shot("more-full-m", true);
await go("/how-it-works", "Manage together"); await shot("how-m", true);
await go("/help", "Help"); await shot("help-m", true);
await go("/apartment/create", "Basic information"); await shot("create-m", true);
await go("/apartment/join", "Join"); await shot("join-m", true);
await page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
await go("/more", "Housing"); await shot("more-d");
await go("/apartment/create", "Basic information"); await shot("create-d");
await browser.close();
