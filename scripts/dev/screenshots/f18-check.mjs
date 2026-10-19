// Fix F18 (owner, 2026-10-18): a closed listing's card never says "Available now" / "Available from";
// an available one still does. It (re)creates two of Jordan's listings, "Rented room (test)" and "Open
// apartment (test)", saved by the resident. Run seed-resident-login.mjs first. Local test data only.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it changes test data");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const OUT = new URL("./outF18/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const db = new pg.Client({ connectionString: src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1] });
await db.connect();
// Two of Jordan's listings, both "available from" a past date: one rented, one open. Both saved by the resident.
const LISTINGS = [["local-listing-f18-rented", "Rented room (test)", "RENTED"], ["local-listing-f18-open", "Open apartment (test)", "APPROVED"]];
for (const [id, title, status] of LISTINGS) {
  await db.query(`DELETE FROM "Listing" WHERE id = $1`, [id]);
  await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, bedrooms, "maxOccupants", "availableFrom", "ownerId", "createdAt", "updatedAt")
    VALUES ($1,'APARTMENT_FOR_RENT',$2,$3,'Test listing for F18.',1500,'Brooklyn',1,2,'2026-09-01','local-roommate',now(),now())`, [id, status, title]);
  await db.query(`INSERT INTO "SavedListing" (id, "userId", "listingId") VALUES ($1, 'local-resident', $2)`, [`local-saved-${id}`, id]);
}
await db.end();

const token = (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "resident@apptmasters.local", password: "LocalTest-2026" }) })).json()).token;
ok(!!token, "the resident's local login works");

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.goto(`${BASE}/saved`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Rented room (test)") && document.body.innerText.includes("Open apartment (test)"), { timeout: 60_000 });
await wait(500);
const card = title => page.evaluate(t => [...document.querySelectorAll("article")].find(a => a.innerText.includes(t))?.innerText ?? "", title);
const rented = await card("Rented room (test)");
const open = await card("Open apartment (test)");
ok(/Rented|No longer available/.test(rented) && !/Available/.test(rented.replace(/No longer available/g, "")), "the rented listing: its label, and no Available line");
ok(/Available now/.test(open), "the available listing still says Available now");
ok(!/New/.test(rented), "the rented listing has no New badge");
await page.screenshot({ path: fileURLToPath(new URL("saved-m.png", OUT)), fullPage: true }); console.log("shot saved-m");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F18 CHECKS PASSED");
process.exit(failures ? 1 : 0);
