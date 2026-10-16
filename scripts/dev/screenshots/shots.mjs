// Screenshots of the LOCAL app (port 3100, test database), to compare each
// screen with the owner's pictures in docs/mockups/. See README.md here.
// Phone shots are one screen (390x844, like the pictures); desktop is 1536x1000.
//   node shots.mjs <outDir> [names...]      e.g.  node shots.mjs out13b home visitor
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const jwt = require("jsonwebtoken");
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
// The local app must run with JWT_SECRET=shots-local-secret (never the live secret).
const SECRET = "shots-local-secret";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [outName = "out", ...only] = process.argv.slice(2);
const OUT = new URL(`./${outName}/`, import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const sign = (userId, email) => jwt.sign({ userId, email }, SECRET, { expiresIn: "2h" });
const seeker = sign("shot-me", "shots-me@example.com");
const member = sign("shot-admin", "shots-admin@example.com");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--no-first-run", "--disable-gpu"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)),
});
const page = await browser.newPage();
page.setDefaultTimeout(120_000);
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
const phone = () => page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const desktop = () => page.setViewport({ width: 1536, height: 1000, deviceScaleFactor: 1 });
const shot = async (name, full = false) => {
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)), fullPage: full });
  console.log("shot", name);
};
const go = async path => {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  if (!res || res.status() >= 400) console.log("STATUS", res?.status(), path);
};
const as = async token => { await go("/login"); await page.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem("token", t); }, token); };
const want = name => only.length === 0 || only.some(o => name.startsWith(o));

if (want("visitor")) {
  await as(null);
  await phone(); await go("/"); await shot("visitor-home-m"); await go("/listings?q=Brooklyn"); await shot("visitor-results-m");
  await desktop(); await go("/"); await shot("visitor-home-d");
}
await as(seeker);
const market = [["home", "/"], ["results", "/listings?q=Brooklyn"], ["details", "/listings/shot-l1"], ["saved", "/saved"],
  ["inbox", "/listings/inbox"], ["thread", "/listings/shot-l1/messages"], ["more", "/more"], ["how", "/how-it-works"], ["help", "/help"], ["mine", "/listings/mine"]];
for (const [name, path] of market) {
  if (!want(name)) continue;
  await phone(); await go(path); await shot(`${name}-m`);
  if (["home", "results", "saved", "thread", "details"].includes(name)) { await desktop(); await go(path); await shot(`${name}-d`); }
}
if (want("household")) {
  await as(member);
  for (const p of ["", "/money", "/cleaning", "/chat", "/calendar"]) {
    const name = `household${p.replace("/", "-") || "-home"}`;
    await phone(); await go(`/apartment/shot-home${p}`); await shot(`${name}-m`);
    await desktop(); await go(`/apartment/shot-home${p}`); await shot(`${name}-d`);
  }
}
await browser.close();
