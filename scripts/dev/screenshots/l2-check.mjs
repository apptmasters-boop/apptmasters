// Listing lifecycle L2 (owner, 2026-10-18): Mark as rented deletes the photos and keeps the
// details; the conversation stays readable but closed for both people; Relist edits the same
// listing with new photos and goes to review; once approved, the conversation opens again.
// Local test data only. Run seed-resident-login.mjs first. Re-runnable; it ends with the room
// rented and its conversation closed, for the owner's test.
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test listings and messages");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const OUT = new URL("./outL2/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

// Jordan (the roommate login) advertises a room, with a real photo file in the uploads folder.
const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const url = src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1];
if (!url.includes("_test")) throw new Error("not the test database");
const db = new pg.Client({ connectionString: url });
await db.connect();
const LISTING = "local-listing-sunny";
// Any small picture will do: a screenshot from an earlier check.
const SAMPLE = fileURLToPath(new URL("./outF13/settings-m.png", import.meta.url));
if (!fs.existsSync(SAMPLE)) throw new Error("run f13-check.mjs once first (it makes the sample picture)");
const photoUrl = `/uploads/listings/${randomUUID()}.png`;
const photoPath = fileURLToPath(new URL(`public${photoUrl}`, PROJECT));
fs.mkdirSync(fileURLToPath(new URL("public/uploads/listings/", PROJECT)), { recursive: true });
fs.copyFileSync(SAMPLE, photoPath);
await db.query(`DELETE FROM "Listing" WHERE id = $1`, [LISTING]);
await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, neighborhood, bedrooms, "maxOccupants", "squareFeet", laundry, "ownerId", "createdAt", "updatedAt")
  VALUES ($1,'ROOM_TO_SHARE','APPROVED','Sunny room near the park','A bright private room in a quiet home.',900,'Brooklyn','Park Slope',1,1,180,'IN_BUILDING','local-roommate',now(),now())`, [LISTING]);
await db.query(`INSERT INTO "ListingPhoto" (id, url, position, "listingId") VALUES ($1,$2,0,$3)`, [`local-photo-${randomUUID()}`, photoUrl, LISTING]);

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
ok(!!resident && !!jordan, "the local logins work");
ok((await api(`/api/listings/${LISTING}/messages`, resident, { content: "Hi! Is the room still available?" })).status === 201, "the resident asks about the room");
ok((await api(`/api/listings/${LISTING}/messages?with=local-resident`, jordan, { content: "Yes! Want to visit on Saturday?" })).status === 201, "Jordan answers");

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
let lastDialog = "";
page.on("dialog", async d => { lastDialog = d.message(); await d.accept(); });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const shot = async (n, full = true) => { await wait(700); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: full }); console.log("shot", n); };
const signIn = async token => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
};
const text = () => page.evaluate(() => document.body.innerText);
const clickIn = (cardText, label) => page.evaluate((c, l) => {
  const card = [...document.querySelectorAll("main div.rounded-2xl")].find(d => d.innerText.includes(c));
  [...(card?.querySelectorAll("a, button") ?? [])].find(e => e.textContent.trim() === l)?.click();
}, cardText, label);
const openThread = async (withUser = "") => {
  await page.goto(`${BASE}/listings/${LISTING}/messages${withUser ? `?with=${withUser}` : ""}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.body.innerText.includes("Want to visit"), { timeout: 60_000 }).catch(() => {});
  await wait(500);
};

// Jordan marks it rented from My listings.
await signIn(jordan);
await page.goto(`${BASE}/listings/mine`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Sunny room near the park"), { timeout: 60_000 });
await clickIn("Sunny room near the park", "Mark as rented");
await wait(2000);
ok(/photos will be deleted/.test(lastDialog) && /details are kept/.test(lastDialog), "the confirmation says the photos are deleted and the details kept");
let t = await text();
ok(/Sunny room near the park[\s\S]*Rented/.test(t) && t.includes("Relist"), "My listings: Rented, with Relist");
ok(!fs.existsSync(photoPath), "its photo file is gone from the disk");
const kept = (await db.query(`SELECT status, price, bedrooms, "squareFeet", laundry, (SELECT count(*) FROM "ListingPhoto" WHERE "listingId" = $1)::int AS photos FROM "Listing" WHERE id = $1`, [LISTING])).rows[0];
ok(kept.status === "RENTED" && kept.photos === 0 && kept.price === 900 && kept.bedrooms === 1 && kept.squareFeet === 180 && kept.laundry === "IN_BUILDING", "the details are kept, the photos gone");
await shot("my-listings-rented-m", false);

// Jordan's side of the conversation: closed, with Relist.
await openThread("local-resident");
t = await text();
ok(t.includes("You marked this place as rented. The conversation is closed.") && !(await page.$("#message")), "Jordan: closed, no message box, Relist offered");

// The resident's side: readable, closed.
await signIn(resident);
await openThread();
t = await text();
ok(t.includes("Jordan Roommate") && t.includes("Sunny room near the park") && t.includes("Want to visit on Saturday?"), "the resident still reads the conversation, with Jordan's name and the card");
ok(t.includes("This place has been rented. The conversation is closed.") && !(await page.$("#message")), "the resident: closed, no message box");
await shot("conversation-closed-m");
const refused = await api(`/api/listings/${LISTING}/messages`, resident, { content: "Hello?" });
ok(refused.status === 400 && refused.data?.error === "This place has been rented. The conversation is closed.", "sending anyway is refused");

// Jordan relists: every detail filled in, no photos; a new price and a new photo → review.
await signIn(jordan);
await page.goto(`${BASE}/listings/mine`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Relist"), { timeout: 60_000 });
await clickIn("Sunny room near the park", "Relist");
await page.waitForFunction(() => document.body.innerText.includes("Relist your listing"), { timeout: 60_000 }).catch(() => {});
t = await text();
ok(t.includes("Relist your listing") && t.includes("Add photos of the apartment as it is now"), "the edit form says Relist and asks for new photos");
ok(await page.evaluate(() => [...document.querySelectorAll("input")].some(i => i.value === "Sunny room near the park")), "the details are filled in");
await shot("relist-form-m");
const price = await page.evaluateHandle(() => [...document.querySelectorAll("label")].find(l => /\(\$\/mo\)/.test(l.textContent)).parentElement.querySelector("input"));
await price.click({ clickCount: 3 }); await page.keyboard.press("Backspace"); await price.type("950");
const file = await page.$('input[type="file"]');
await file.uploadFile(SAMPLE);
await page.waitForFunction(() => document.querySelectorAll("main img").length > 0, { timeout: 60_000 }).catch(() => {});
await wait(800);
await page.evaluate(() => [...document.querySelectorAll('button[type="submit"]')].find(b => b.textContent.trim() === "Relist")?.click());
await page.waitForFunction(() => location.pathname === "/listings/mine", { timeout: 60_000 }).catch(() => {});
await page.waitForFunction(() => document.body.innerText.includes("Waiting for review"), { timeout: 30_000 }).catch(() => {});
t = await text();
ok(/Sunny room near the park[\s\S]*Waiting for review/.test(t), "after Relist: Waiting for review");
const relisted = (await db.query(`SELECT status, price, (SELECT count(*) FROM "ListingPhoto" WHERE "listingId" = $1)::int AS photos FROM "Listing" WHERE id = $1`, [LISTING])).rows[0];
ok(relisted.status === "PENDING" && relisted.price === 950 && relisted.photos === 1, "saved: PENDING, $950, one new photo");

// The admin approves: back in search, and the conversation opens again.
await db.query(`UPDATE "Listing" SET status = 'APPROVED' WHERE id = $1`, [LISTING]);
ok((await api(`/api/listings/search?q=Brooklyn`)).data?.listings?.some(l => l.id === LISTING), "approved: it's back in search");
await signIn(resident);
await openThread();
ok(!!(await page.$("#message")), "the conversation is open again");

// Leave it rented for the owner's test (this also deletes the new photo).
ok((await api(`/api/listings/${LISTING}`, jordan, { action: "MARK_RENTED" }, "PATCH")).status === 200, "rented again, for the owner's test");

await db.end();
await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL L2 CHECKS PASSED");
process.exit(failures ? 1 : 0);
