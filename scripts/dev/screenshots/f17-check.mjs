// Fix F17 (owner, 2026-10-18): Money → Overview has no "What's next" box at all; payments
// recorded with "Record payment" are answered on Balances ("Payments to confirm"); the payment
// notification opens Balances; after recording a payment, Money shows Balances.
// Run seed-resident-login.mjs first (it starts Maple House over). Local test data only.
// Leaves one payment from Jordan waiting for the owner's test.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test expenses and payments");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const HOME = "local-home-maple";
const OUT = new URL("./outF17/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

async function api(path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const login = async email => (await api("/api/auth/login", null, { email, password: "LocalTest-2026" })).data.token;
const resident = await login("resident@apptmasters.local");
const jordan = await login("roommate@apptmasters.local");
ok(!!resident && !!jordan, "both local logins work");

/** The resident pays $20 of groceries (Jordan owes $10); then Jordan says they paid it. */
async function groceries() { return (await api(`/api/apartments/${HOME}/expenses`, resident, { title: "Groceries", amount: 20 })).status < 300; }
async function jordanPays() {
  const items = await api(`/api/apartments/${HOME}/payments?with=local-resident`, jordan);
  const item = items.data?.owe?.[0];
  return (await api(`/api/apartments/${HOME}/payments`, jordan, { toUserId: "local-resident", owe: [{ type: item?.type, id: item?.id }], method: "CASH" })).status < 300;
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const shot = async n => { await wait(600); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: true }); console.log("shot", n); };
const text = () => page.evaluate(() => document.body.innerText);
const openMoney = async (token, query = "") => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
  await page.goto(`${BASE}/apartment/${HOME}/money${query}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => /You owe|You're owed|All settled up|owes|owe you|Nobody owes/i.test(document.body.innerText), { timeout: 60_000 });
  await wait(500);
};
const selectedTab = () => page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim().toLowerCase());

// Something is waiting: the Overview still has no box.
ok(await groceries() && await jordanPays(), "Jordan owes $10 and says they paid it");
await openMoney(resident);
let t = await text();
ok(!/What's next/i.test(t) && !/says they paid you/.test(t) && !/Nothing waiting/.test(t), "Overview: no What's next box, even with a payment waiting");
await shot("overview-m");

// The notification opens Balances.
const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const db = new pg.Client({ connectionString: src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1] });
await db.connect();
const link = (await db.query(`SELECT link FROM "Notification" WHERE "userId" = 'local-resident' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0]?.link;
await db.end();
ok(link === `/apartment/${HOME}/money?tab=balances`, `the payment notification opens Balances: ${link}`);

// Balances: answer it there.
await openMoney(resident, "?tab=balances");
ok(await selectedTab() === "balances", "?tab=balances opens on Balances");
t = await text();
ok(/Payments to confirm/i.test(t) && t.includes("Jordan Roommate says they paid you"), "Balances: Payments to confirm, Jordan Roommate says they paid you");
await shot("balances-to-confirm-m");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Confirm")?.click());
await page.waitForFunction(() => !document.body.innerText.includes("says they paid you"), { timeout: 30_000 }).catch(() => {});
t = await text();
ok(!t.includes("says they paid you") && !/Payments to confirm/i.test(t), "after Confirm the row and the section go away");

// Jordan records a payment with the window: Money switches to Balances, where it waits.
ok(await groceries(), "a new $20 of groceries: Jordan owes $10 again");
await openMoney(jordan, "?tab=balances");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Record payment")?.click());
await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });
await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] input[type="checkbox"]').length > 0, { timeout: 30_000 });
await page.evaluate(() => { const box = document.querySelector('[role="dialog"] input[type="checkbox"]'); if (!box.checked) box.click(); });
await wait(300);
await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim().startsWith("Send"))?.click());
await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 30_000 }).catch(() => {});
await wait(1200);
t = await text();
ok(await selectedTab() === "balances", "after recording a payment, Money shows Balances");
ok(t.includes("Waiting for Riley Resident to confirm your payment") && t.includes("Cancel"), "Jordan sees: Waiting for Riley Resident to confirm your payment, with Cancel");
await shot("balances-waiting-m");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F17 CHECKS PASSED");
process.exit(failures ? 1 : 0);
