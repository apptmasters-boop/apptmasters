// Fix F19 (owner, 2026-10-23): contacting an advertiser when not signed in, or when the sign-in
// expired, goes to sign up (then back), the same way as Save; a message typed when the sign-in
// expired comes back after signing in. Local copy only (it signs a test token with the local secret).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const jwt = require("jsonwebtoken");
const OUT = new URL("./outF19/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
const LISTING = "shot-l1";
const THREAD = `/listings/${LISTING}/messages`;
// A sign-in that expired a minute ago (the local copy signs with JWT_SECRET=shots-local-secret).
const expired = jwt.sign({ userId: "local-resident", email: "resident@apptmasters.local", exp: Math.floor(Date.now() / 1000) - 60 }, "shots-local-secret");

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const path = () => { const u = new URL(page.url()); return u.pathname + u.search; };
const setToken = t => page.evaluate(v => { localStorage.clear(); sessionStorage.clear(); if (v) localStorage.setItem("token", v); }, t);
const pressContact = async () => {
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /^(Contact|Message)$/.test(b.textContent.trim()) && !b.disabled), { timeout: 60_000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Contact|Message)$/.test(b.textContent.trim()))?.click());
};
const signupFor = encodeURIComponent(THREAD);

// 1. Never signed in: Contact → sign up, coming back to the conversation.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await setToken(null);
await page.goto(`${BASE}/listings/${LISTING}`, { waitUntil: "networkidle2" });
await wait(800);
await pressContact();
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(path() === `/signup?returnTo=${signupFor}`, `signed out: Contact → ${path()}`);

// 2. An expired sign-in: the app forgets it; Contact goes to sign up too.
await setToken(expired);
await page.goto(`${BASE}/listings/${LISTING}`, { waitUntil: "networkidle2" });
await wait(1500);
ok(await page.evaluate(() => localStorage.getItem("token")) === null, "an expired sign-in is forgotten once the server says so");
await pressContact();
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(path() === `/signup?returnTo=${signupFor}`, `expired: Contact → ${path()}`);

// 3. Opening the conversation with an expired sign-in: sign up, not a page that can't send.
await setToken(expired);
await page.goto(`${BASE}${THREAD}`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(path() === `/signup?returnTo=${signupFor}`, `expired: the conversation page → ${path()}`);

// 4. It expires while typing: the message is kept, and comes back after signing in.
const token = (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "resident@apptmasters.local", password: "LocalTest-2026" }) })).json()).token;
ok(!!token, "the resident's local login works");
await setToken(token);
await page.goto(`${BASE}${THREAD}`, { waitUntil: "networkidle2" });
await page.waitForSelector("#message", { timeout: 60_000 });
const typed = `Hi! Is it still available? (F19 check ${Date.now()})`;
await page.type("#message", typed);
await page.evaluate(v => localStorage.setItem("token", v), expired); // the sign-in runs out while typing
await page.click('button[aria-label="Send"]');
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(path() === `/signup?returnTo=${signupFor}`, `expired while typing: Send → ${path()}`);
ok(!(await page.evaluate(() => document.body.innerText.includes("Unauthorized"))), "no \"Unauthorized\" shown");
// Already have an account? Sign in → back to the conversation, the message waiting.
await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "Sign in")?.click());
await page.waitForFunction(() => location.pathname === "/login", { timeout: 30_000 }).catch(() => {});
await page.type('input[type="email"]', "resident@apptmasters.local");
await page.type('input[type="password"]', "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForSelector("#message", { timeout: 60_000 }).catch(() => {});
await wait(800);
ok(path() === THREAD, `signed in again → ${path()}`);
ok(await page.$eval("#message", t => t.value).catch(() => "") === typed, "the typed message is back in the box");
ok((await page.evaluate(() => document.body.innerText)).includes("Your message is still here: press Send."), "it says so");
await page.screenshot({ path: fileURLToPath(new URL("draft-back-m.png", OUT)) }); console.log("shot draft-back-m");
await page.click('button[aria-label="Send"]');
await page.waitForFunction(t => document.body.innerText.includes(t) && !document.querySelector("#message").value, { timeout: 30_000 }, typed).catch(() => {});
ok((await page.evaluate(() => document.body.innerText)).includes(typed), "Send works: the message is in the conversation");
ok(await page.evaluate(() => Object.keys(localStorage).every(k => !k.startsWith("am:draft:"))), "the kept message is cleared once sent");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F19 CHECKS PASSED");
process.exit(failures ? 1 : 0);
