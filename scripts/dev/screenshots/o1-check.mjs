// Step O1: "What brings you to ApptMasters?" on the sign-up form: required, pre-selected from where
// people came from, and each answer lands in the right place after confirming. Local copy only
// (it creates test accounts; the confirmation links come from the local app's log).
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
const signOut = async () => { await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" }); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
const chosen = () => page.evaluate(() => document.querySelector('input[name="intent"]:checked')?.value ?? null);
const choose = title => page.evaluate(t => [...document.querySelectorAll("fieldset#intent label")].find(l => l.textContent.includes(t))?.click(), title);
async function fill(address) {
  await page.type('input[autocomplete="name"]', "O1 Tester");
  await page.type('input[type="email"]', address);
  await page.type('input[autocomplete="new-password"]', "LocalTest-2026");
}
const submit = () => page.evaluate(() => document.querySelector('form button[type="submit"]').click());
async function signUpAndConfirm(address) {
  await submit();
  await page.waitForFunction(() => document.body.innerText.includes("Check your email"), { timeout: 60_000 });
  await wait(500);
  const link = confirmLink(address);
  await page.goto(link, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => !location.pathname.startsWith("/verify-email"), { timeout: 60_000 }).catch(() => {});
  await wait(1500);
  return new URL(page.url());
}

// 1. The plain Sign up: nothing chosen, and it can't be sent without a choice.
await signOut();
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle2" });
ok(await chosen() === null, "plain Sign up: nothing chosen");
ok((await text()).includes("What brings you to ApptMasters?") && (await text()).includes("Choose what brings you here"), "the question comes first; the button asks for a choice");
await shot("signup-plain-m");
await fill(email("none"));
await submit(); await wait(800);
ok((await text()).includes("Choose what brings you to ApptMasters.") && !(await text()).includes("Check your email"), "Create account without a choice: asked to choose, nothing sent");

// 2. Rent out a place → Post a listing.
await choose("Rent out a place");
ok(await chosen() === "RENT_OUT", "Rent out a place chosen");
await page.evaluate(() => { const i = document.querySelector('input[type="email"]'); i.value = ""; });
await page.click('input[type="email"]', { clickCount: 3 }); await page.keyboard.press("Backspace");
await page.type('input[type="email"]', email("rent"));
await shot("signup-chosen-m");
let landed = await signUpAndConfirm(email("rent"));
ok(landed.pathname === "/listings/new", `Rent out → after confirming: ${landed.pathname}`);

// 3. Set up my home → Create a Home.
await signOut();
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle2" });
await choose("Set up my home"); await fill(email("home"));
landed = await signUpAndConfirm(email("home"));
ok(landed.pathname === "/apartment/create", `Set up my home → after confirming: ${landed.pathname}`);
ok((await text()).includes("Join their home"), "Create a Home offers Join their home");

// 4. Find a place to live → Home.
await signOut();
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle2" });
await choose("Find a place to live"); await fill(email("find"));
landed = await signUpAndConfirm(email("find"));
ok(landed.pathname === "/", `Find a place → after confirming: ${landed.pathname}`);

// 5. Pre-selected from where they came from.
await signOut();
await page.goto(`${BASE}/listings/new`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(await chosen() === "RENT_OUT", "Post a listing → Rent out a place already chosen");
await page.goto(`${BASE}/apartment/create`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 30_000 }).catch(() => {});
ok(new URL(page.url()).pathname === "/signup" && await chosen() === "HAVE_HOME", "Create a Home sends visitors to sign up, with Set up my home chosen");
await page.goto(`${BASE}/signup?returnTo=${encodeURIComponent("/listings/shot-l1?save=shot-l1")}`, { waitUntil: "networkidle2" });
ok(await chosen() === "FIND_HOME", "Saving a listing → Find a place to live already chosen");
await fill(email("save"));
landed = await signUpAndConfirm(email("save"));
ok(landed.pathname === "/listings/shot-l1", `after confirming, back on the listing they saved: ${landed.pathname}`);

// 6. The visitor Home has a way in for people who already have a place.
await signOut();
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
const t = await text();
ok(t.includes("Already have a place?"), "the visitor Home shows Already have a place?");
await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "Create a home")?.click());
await page.waitForFunction(() => location.pathname === "/signup", { timeout: 60_000 }).catch(() => {});
ok(await chosen() === "HAVE_HOME", "its Create a home leads to sign up with Set up my home chosen");
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.evaluate(() => [...document.querySelectorAll("h2")].find(h => h.textContent.includes("Already have a place?"))?.scrollIntoView({ block: "center" }));
await wait(500);
await page.screenshot({ path: fileURLToPath(new URL("visitor-home-m.png", OUT)) }); console.log("shot visitor-home-m");

// 7. Later sign-ins: Rent out starts on My listings (one login, mind the 5-per-minute limit).
await signOut();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.type('input[type="email"]', email("rent"));
await page.type('input[type="password"]', "LocalTest-2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForFunction(() => location.pathname !== "/login", { timeout: 60_000 }).catch(() => {});
await wait(1000);
ok(new URL(page.url()).pathname === "/listings/mine", `Rent out, signing in again → ${new URL(page.url()).pathname}`);
ok((await text()).includes("Ask us for the landlord tools"), "My listings (empty) mentions the landlord tools");
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" }); await wait(800);
ok(new URL(page.url()).pathname === "/", "and Home stays open to them");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL O1 CHECKS PASSED");
process.exit(failures ? 1 : 0);
