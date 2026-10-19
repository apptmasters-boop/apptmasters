// Step O1 (owner, 2026-10-18): "What brings you to ApptMasters?" is asked right after the email
// is confirmed (/welcome), not on the sign-up form: required, pre-selected from what people were
// doing, each answer lands in the right place, and someone who leaves it is asked at their next
// sign-in. Local copy only (it creates test accounts; confirmation links come from the local log).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test accounts");
const OUT = new URL("./outO1/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
const run = Date.now();
const email = kind => `o1-${kind}-${run}@example.com`;
const confirmLink = address => execFileSync("node", [fileURLToPath(new URL("./confirm-link.mjs", import.meta.url)), address], { encoding: "utf8" }).trim();

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const shot = async n => { await wait(600); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: true }); console.log("shot", n); };
const text = () => page.evaluate(() => document.body.innerText);
const path = () => new URL(page.url()).pathname;
const signOut = async () => { await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" }); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
const chosen = () => page.evaluate(() => document.querySelector('input[name="intent"]:checked')?.value ?? null);
const choose = title => page.evaluate(t => [...document.querySelectorAll("fieldset#intent label")].find(l => l.textContent.includes(t))?.click(), title);
const continueButton = () => page.evaluate(() => { const b = document.querySelector('form button[type="submit"]'); return { text: b?.textContent.trim(), disabled: !!b?.disabled }; });

/** Sign up on /signup (as it is when they get there) and confirm; they should land on /welcome. */
async function signUpAndConfirm(address) {
  await page.waitForSelector('input[autocomplete="name"]', { timeout: 60_000 });
  await page.type('input[autocomplete="name"]', "O1 Tester");
  await page.type('input[type="email"]', address);
  await page.type('input[autocomplete="new-password"]', "LocalTest-2026");
  await page.evaluate(() => document.querySelector('form button[type="submit"]').click());
  await page.waitForFunction(() => document.body.innerText.includes("Check your email"), { timeout: 60_000 });
  await wait(500);
  await page.goto(confirmLink(address), { waitUntil: "networkidle2" });
  await page.waitForFunction(() => location.pathname === "/welcome" && document.querySelector("fieldset#intent"), { timeout: 60_000 }).catch(() => {});
  await wait(500);
}
async function answerAndGo() {
  await page.evaluate(() => document.querySelector('form button[type="submit"]').click());
  await page.waitForFunction(() => location.pathname !== "/welcome", { timeout: 60_000 }).catch(() => {});
  await wait(1200);
  return path();
}

// 1. The sign-up form: three fields, no question.
await signOut();
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle2" });
const t1 = await text();
ok(!t1.includes("What brings you to ApptMasters?") && !(await page.$('input[name="intent"]')), "the sign-up form has no question");
ok((await page.$$("form input")).length === 3, "three fields: name, email, password");
await shot("signup-m");

// 2. A plain Sign up → after confirming, the question; required; looking → Home.
await signUpAndConfirm(email("find"));
ok(path() === "/welcome", `after confirming: ${path()}`);
ok(await chosen() === null, "nothing chosen after a plain Sign up");
let btn = await continueButton();
ok(btn.disabled && btn.text === "Choose one to continue", "Continue waits for a choice");
await shot("welcome-m");
await choose("I'm looking for a place");
btn = await continueButton();
ok(!btn.disabled && btn.text === "Continue", "a choice enables Continue");
ok(await answerAndGo() === "/", "I'm looking for a place → Home");

// 3. From Post a listing → rent out pre-selected → Post a listing.
await signOut();
await page.goto(`${BASE}/listings/new`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
await signUpAndConfirm(email("rent"));
ok(await chosen() === "RENT_OUT", "from Post a listing: I have a place to rent out already chosen");
ok(await answerAndGo() === "/listings/new", "→ Post a listing");

// 4. From the visitor Home's Already have a place? → already have a place → Create a Home.
await signOut();
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
ok((await text()).includes("Already have a place?"), "the visitor Home shows Already have a place?");
await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "Create a home")?.click());
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 60_000 }).catch(() => {});
await signUpAndConfirm(email("home"));
ok(await chosen() === "HAVE_HOME", "from Create a home: I already have a place already chosen");
ok(await answerAndGo() === "/apartment/create", "→ Create a Home");
ok((await text()).includes("Join their home"), "Create a Home offers Join their home");

// 5. Saving a listing → looking pre-selected → back on the listing.
await signOut();
await page.goto(`${BASE}/signup?returnTo=${encodeURIComponent("/listings/shot-l1?save=shot-l1")}`, { waitUntil: "networkidle2" });
await signUpAndConfirm(email("save"));
ok(await chosen() === "FIND_HOME", "from Save: I'm looking for a place already chosen");
ok(await answerAndGo() === "/listings/shot-l1", "→ back on the listing they saved");

// 6. Leaving without answering: asked at the next sign-in. (Sign-ups are limited to 5 a minute.)
await wait(61_000);
await signOut();
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle2" });
await signUpAndConfirm(email("skip"));
ok(path() === "/welcome", "the question shows after confirming");
await page.goto(`${BASE}/listings`, { waitUntil: "networkidle2" }); // they walk away
await signOut();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type('input[type="email"]', email("skip"));
await page.type('input[type="password"]', "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForFunction(() => location.pathname !== "/login", { timeout: 60_000 }).catch(() => {});
await wait(1000);
ok(path() === "/welcome", `next sign-in, still unanswered → ${path()}`);

// 7. Rent out, signing in again → My listings.
await signOut();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type('input[type="email"]', email("rent"));
await page.type('input[type="password"]', "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForFunction(() => location.pathname !== "/login", { timeout: 60_000 }).catch(() => {});
await wait(1000);
ok(path() === "/listings/mine", `rent out, signing in again → ${path()}`);
ok((await text()).includes("Ask us for the landlord tools"), "My listings (empty) mentions the landlord tools");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL O1 CHECKS PASSED");
process.exit(failures ? 1 : 0);
