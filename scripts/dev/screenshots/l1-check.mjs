// Listing lifecycle L1: a conversation keeps working after the listing closes (name, photo, card,
// "No longer available", replies; "View listing" opens a short page). Local test data only.
// Run seed-resident-login.mjs first. Re-runnable; leaves the conversation for the owner's test.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test listings and messages");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const OUT = new URL("./outL1/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

// Jordan (the roommate login) advertises a room.
const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const url = src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1];
if (!url.includes("_test")) throw new Error("not the test database");
const db = new pg.Client({ connectionString: url });
await db.connect();
const LISTING = "local-listing-sunny";
await db.query(`DELETE FROM "Listing" WHERE id = $1`, [LISTING]);
await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, neighborhood, bedrooms, "ownerId", "createdAt", "updatedAt")
  VALUES ($1,'ROOM_TO_SHARE','APPROVED','Sunny room near the park','A bright private room in a quiet home.',900,'Brooklyn','Park Slope',1,'local-roommate',now(),now())`, [LISTING]);
await db.query(`INSERT INTO "ListingPhoto" (id, url, position, "listingId") VALUES ('local-photo-sunny','/landing/hero.png',0,$1)`, [LISTING]);
await db.end();

async function api(path, token, body, method) {
  const res = await fetch(`${BASE}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const login = async email => (await api("/api/auth/login", null, { email, password: "LocalTest-2026" })).data.token;
const resident = await login("resident@apptmasters.local");
const jordan = await login("roommate@apptmasters.local");
const stranger = await login("owner@apptmasters.local");
ok(!!resident && !!jordan && !!stranger, "the three local logins work");

ok((await api(`/api/listings/${LISTING}/messages`, resident, { content: "Hi! Is the room still available?" })).status === 201, "the resident asks about the room");
ok((await api(`/api/listings/${LISTING}/messages?with=local-resident`, jordan, { content: "Yes! Want to visit on Saturday?" })).status === 201, "Jordan answers");
ok((await api(`/api/listings/${LISTING}`, jordan, { action: "MARK_REMOVED" }, "PATCH")).status === 200, "Jordan marks it rented");

// Who sees what, now that it's closed.
const summary = await api(`/api/listings/${LISTING}`, resident);
ok(summary.status === 200 && summary.data.status === "UNAVAILABLE" && summary.data.owner?.name === "Jordan Roommate" && !("description" in summary.data), "the resident gets the short summary (no description)");
ok((await api(`/api/listings/${LISTING}`, stranger)).status === 404, "someone who never wrote gets Not found");
const newcomer = await api(`/api/listings/${LISTING}/messages`, stranger, { content: "Hello" });
ok(newcomer.status === 400 && newcomer.data?.error === "This listing is no longer available", "someone new can't start a conversation about it");

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
const shot = async (n, full = false) => { await wait(700); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: full }); console.log("shot", n); };
const signIn = async token => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
};
const text = () => page.evaluate(() => document.body.innerText);

// The resident, on a phone.
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await signIn(resident);
await page.goto(`${BASE}/listings/${LISTING}/messages`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Want to visit"), { timeout: 60_000 });
let t = await text();
ok(t.includes("Jordan Roommate"), "the conversation still shows Jordan's name");
ok(t.includes("Sunny room near the park") && /No longer available/.test(t), "the apartment card stays, marked No longer available");
ok(t.includes("You can still write to Jordan here."), "it says you can still write to each other");
await shot("conversation-m");

await page.type("#message", "Thanks anyway, good luck!");
await page.click('button[aria-label="Send"]');
await page.waitForFunction(() => document.body.innerText.includes("good luck"), { timeout: 30_000 }).catch(() => {});
t = await text();
ok(t.includes("Thanks anyway, good luck!") && !(await page.$('[role="alert"]')), "the reply goes through (no error)");
const jordanSees = await api(`/api/listings/${LISTING}/messages?with=local-resident`, jordan);
ok(jordanSees.data?.some(m => m.content === "Thanks anyway, good luck!"), "Jordan gets the reply");
ok((await api(`/api/listings/${LISTING}/messages?with=local-resident`, jordan, { content: "Thank you! I'll let you know if something opens up." })).status === 201, "Jordan can answer");

// View listing: the short page.
await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "View listing")?.click());
await page.waitForFunction(() => document.body.innerText.includes("Open the conversation"), { timeout: 60_000 }).catch(() => {});
t = await text();
ok(new URL(page.url()).pathname === `/listings/${LISTING}` && /No longer available/.test(t) && t.includes("Open the conversation"), "View listing opens the short No longer available page");
const similar = await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "Find similar apartments")?.getAttribute("href"));
ok(similar === "/listings?q=Brooklyn&kind=room", `Find similar apartments: ${similar}`);
await shot("closed-listing-m");

// On a computer: the panel keeps the card and contact; no Save or Share for a closed listing.
await page.setViewport({ width: 1536, height: 1000 });
await page.goto(`${BASE}/listings/${LISTING}/messages`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Contact information"), { timeout: 60_000 }).catch(() => {});
t = await text();
ok(t.includes("Contact information") && t.includes("Jordan Roommate"), "computer: the contact panel is there");
ok(!t.includes("Share listing") && !t.includes("Save listing") && t.includes("Report this listing"), "computer: no Save or Share for a closed listing; Report stays");
await shot("conversation-d");
// Report from the conversation opens the report window on the short page (a scam can still be reported).
await page.evaluate(() => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === "Report this listing")?.click());
await page.waitForSelector('[role="dialog"][aria-label="Report this listing"]', { timeout: 60_000 }).catch(() => {});
ok(!!(await page.$('[role="dialog"][aria-label="Report this listing"]')), "Report this listing opens the report window for a closed listing");

// An open listing still shows the full page (nothing changed there).
await page.goto(`${BASE}/listings/shot-l1`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => /Contact|Message/.test(document.body.innerText), { timeout: 60_000 }).catch(() => {});
t = await text();
ok(!/No longer available/.test(t) && /Contact|Message/.test(t) && !t.includes("Open the conversation"), "an open listing still shows its full page");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL L1 CHECKS PASSED");
process.exit(failures ? 1 : 0);
