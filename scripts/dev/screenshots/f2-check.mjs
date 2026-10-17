// Fix F2: the bare top bar (signed out / signed in, menu open), the footer, and every link in them.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const OUT = new URL("./outF2/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
const shot = async (n, full = false) => { await new Promise(r => setTimeout(r, 1000)); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: full }); console.log("shot", n); };
const go = async p => { await page.goto(`${BASE}${p}`, { waitUntil: "networkidle2" }); await new Promise(r => setTimeout(r, 800)); };
const headerTexts = () => page.$$eval("header a, header button", els => els.filter(e => e.offsetParent !== null).map(e => (e.getAttribute("aria-label") || e.textContent).trim().replace(/\s+/g, " ")));

// Signed out, computer.
await page.setViewport({ width: 1536, height: 1000 });
await go("/login"); await page.evaluate(() => localStorage.clear());
await go("/listings");
const outHeader = await headerTexts();
console.log("signed-out header:", outHeader.join(" | "));
ok(!outHeader.some(t => /^(Home|Find a Home|How It Works|More|Search)$/.test(t)), "no Home / Find a Home / How It Works / More / search in the top bar");
ok(outHeader.includes("Log in") && outHeader.includes("Sign up"), "Log in and Sign up are there");
await shot("signed-out-d");
const footerLinks = await page.$$eval("footer a", as => as.map(a => [a.textContent.trim(), a.getAttribute("href")]));
console.log("footer:", footerLinks.map(l => l[0]).join(" · "));
ok(footerLinks.length === 3, "footer has How It Works, Help, Post a listing");
await shot("footer-d", true);

// Signed in (the owner's local account), computer.
await go("/login");
await page.type("input[type=email]", "owner@apptmasters.local");
await page.type("input[type=password]", "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await new Promise(r => setTimeout(r, 1500));
await go("/listings");
const inHeader = await headerTexts();
console.log("signed-in header:", inHeader.join(" | "));
ok(inHeader.length === 2, "only the logo and the name button");
ok(await page.$eval("header", h => !!h.querySelector('[aria-label$="unread"]')), "red dot for unread messages");
await shot("signed-in-d");
await page.evaluate(() => [...document.querySelectorAll("header button")].find(b => b.offsetParent !== null && b.getAttribute("aria-expanded") !== null)?.click());
await new Promise(r => setTimeout(r, 500));
const menu = await page.$$eval("header a, header button", els => els.filter(e => e.offsetParent !== null).map(e => [e.textContent.trim().replace(/\s+/g, " "), e.getAttribute("href")]));
console.log("menu:", menu.map(m => m[0]).join(" | "));
ok(menu.some(m => m[0].startsWith("Messages1")), "Messages shows 1 unread conversation (2 unread messages in it)");
ok(menu.some(m => m[0].startsWith("Saved2")), "Saved shows 2");
await shot("menu-open-d");

// Every link in the menu and the footer opens its page.
const hrefs = [...new Set([...menu.map(m => m[1]), ...footerLinks.map(l => l[1])].filter(h => h && h.startsWith("/")))];
for (const h of hrefs) {
  const res = await page.goto(`${BASE}${h}`, { waitUntil: "domcontentloaded" });
  ok(res && res.status() === 200, `${h} opens (${res?.status()})`);
}

// Phone: unchanged (logo bar on Home only, bottom bar).
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await go("/"); await shot("home-m");
await go("/listings"); await shot("results-m");
ok(await page.$eval("header", h => getComputedStyle(h).display === "none"), "phone: no logo bar on Find a Home");
await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F2 CHECKS PASSED");
process.exit(failures ? 1 : 0);
