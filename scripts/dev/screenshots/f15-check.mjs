// Fix F15: Money → Overview shows "What's next" only when something is waiting; no "Nothing waiting for you".
// Run seed-resident-login.mjs first (it starts Maple House over). Leaves one payment waiting for the owner's test.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test expenses and payments");
const HOME = "local-home-maple";
const OUT = new URL("./outF15/", import.meta.url);
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
const roommate = await login("roommate@apptmasters.local");
ok(!!resident && !!roommate, "both local logins work");

/** The resident pays $20 of groceries; Jordan says they paid their $10 share. */
async function jordanSaysPaid() {
  const expense = await api(`/api/apartments/${HOME}/expenses`, resident, { title: "Groceries", amount: 20 });
  const items = await api(`/api/apartments/${HOME}/payments?with=local-resident`, roommate);
  const item = items.data?.owe?.[0];
  const payment = await api(`/api/apartments/${HOME}/payments`, roommate, { toUserId: "local-resident", owe: [{ type: item?.type, id: item?.id }], method: "CASH" });
  return expense.status < 300 && payment.status < 300;
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const shot = async n => { await wait(600); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: true }); console.log("shot", n); };
const openMoney = async token => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
  await page.goto(`${BASE}/apartment/${HOME}/money`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => /You owe|You're owed|All settled up/i.test(document.body.innerText), { timeout: 60_000 });
  await wait(500);
};
const body = () => page.evaluate(() => document.body.innerText);

// 1. Nothing waiting: no box, no line.
await openMoney(resident);
let text = await body();
ok(!/What's next/i.test(text) && !/Nothing waiting for you/.test(text), "nothing waiting: no What's next box, no \"Nothing waiting for you\"");
await shot("nothing-waiting");

// 2. Jordan says they paid: the box shows, with Confirm.
ok(await jordanSaysPaid(), "Jordan records a $10 cash payment to the resident");
await openMoney(resident);
text = await body();
ok(/What's next/i.test(text) && /says they paid you/.test(text) && /\$10\.00/.test(text), "the box shows: \"says they paid you\", $10.00");
const name = text.match(/(\S+(?: \S+)?) says they paid you/)?.[1];
console.log("   shown as:", name);
await shot("payment-waiting");

// 3. Confirm: nothing is waiting any more, the box goes away.
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Confirm")?.click());
await page.waitForFunction(() => !/What's next/i.test(document.body.innerText), { timeout: 30_000 }).catch(() => {});
text = await body();
ok(!/What's next/i.test(text) && !/Nothing waiting for you/.test(text), "after Confirm the box goes away");

// 4. Jordan's side, with a new payment waiting (left for the owner's test).
ok(await jordanSaysPaid(), "a new payment waits for the owner's test");
await openMoney(roommate);
text = await body();
ok(/What's next/i.test(text) && /Waiting for .+ to confirm your payment/.test(text), "Jordan sees \"Waiting for … to confirm your payment\"");
await shot("roommate-waiting");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F15 CHECKS PASSED");
process.exit(failures ? 1 : 0);
