// Fix F21 (owner, 2026-10-23): the listing form's notes box describes the home ("House customs"),
// not who may live there, and the listing shows it under its own heading, apart from the roommate
// wishes. It (re)creates one of Jordan's room listings with house customs. Local test data only.
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it changes test data");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const OUT = new URL("./outF21/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

const ID = "local-listing-f21-room";
const CUSTOMS = "Halal kitchen. Shoes off inside. Quiet after 10 pm.";
const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const db = new pg.Client({ connectionString: src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1] });
await db.connect();
await db.query(`DELETE FROM "Listing" WHERE id = $1`, [ID]);
await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, bedrooms, "maxOccupants", "availableFrom", "ownerId",
    "roommateGenderPref", "roommateCulturalNotes", "createdAt", "updatedAt")
  VALUES ($1,'ROOM_TO_SHARE','APPROVED','Room with house customs (test)','Test listing for F21.',900,'Brooklyn',2,2,'2026-12-01','local-roommate',
    'ANY',$2,now(),now())`, [ID, CUSTOMS]);
await db.end();

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

// 1. The listing: House customs under its own heading, not in the roommate wishes.
await page.goto(`${BASE}/listings/${ID}`, { waitUntil: "networkidle2" });
await page.waitForFunction(t => document.body.innerText.includes(t), { timeout: 60_000 }, "Room with house customs (test)").catch(() => {});
const sections = await page.$$eval("section", (ss, t) => ss.map(s => ({ h: s.querySelector("h2")?.textContent.trim() ?? "", has: s.innerText.includes(t) })), CUSTOMS);
ok(sections.some(s => s.h === "House customs" && s.has), "the listing shows them under \"House customs\"");
ok(!sections.some(s => s.h.startsWith("The roommate they") && s.has), "not under \"The roommate they're looking for\"");
ok(sections.some(s => s.h.startsWith("The roommate they")), "the roommate wishes are still there");
await page.evaluate(() => [...document.querySelectorAll("h2")].find(h => h.textContent.trim() === "House customs")?.scrollIntoView({ block: "center" }));
await wait(400);
await page.screenshot({ path: fileURLToPath(new URL("listing-m.png", OUT)) }); console.log("shot listing-m");

// 2. The form: the box is "House customs (optional)", after the roommate wishes, with the new example and hint.
const token = (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "roommate@apptmasters.local", password: "LocalTest-2026" }) })).json()).token;
ok(!!token, "Jordan's local login works");
await page.evaluate(t => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("token", t); }, token);
await page.goto(`${BASE}/listings/new`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Room to share"), { timeout: 60_000 }).catch(() => {});
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Room to share")?.click());
await page.waitForSelector("#house-customs", { timeout: 30_000 }).catch(() => {});
const form = await page.evaluate(() => {
  const box = document.querySelector("#house-customs");
  const wishes = [...document.querySelectorAll("p")].find(p => p.textContent.startsWith("Roommate you"))?.parentElement;
  return {
    label: document.querySelector("label[for=house-customs]")?.textContent.trim(),
    placeholder: box?.getAttribute("placeholder"),
    hint: box?.previousElementSibling?.textContent.trim(),
    insideWishes: !!(wishes && box && wishes.contains(box)),
    afterWishes: !!(wishes && box && (wishes.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING)),
    oldText: document.body.innerText.includes("Fulani") || document.body.innerText.includes("religious notes"),
  };
});
ok(form.label === "House customs (optional)", `the label: ${form.label}`);
ok(form.placeholder === "e.g. Halal kitchen, shoes off inside, quiet after 10 pm", `the example: ${form.placeholder}`);
ok(form.hint === "Describe the home and how it's run, not who may live there.", `the hint: ${form.hint}`);
ok(!form.insideWishes && form.afterWishes, "its own place, after \"Roommate you're looking for\"");
ok(!form.oldText, "the old label and example are gone");
await page.evaluate(() => document.querySelector("#house-customs")?.scrollIntoView({ block: "center" }));
await wait(400);
await page.screenshot({ path: fileURLToPath(new URL("form-m.png", OUT)) }); console.log("shot form-m");
// An apartment has no house customs box (the server only keeps it for rooms).
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Apartment for rent")?.click());
await wait(400);
ok(!(await page.$("#house-customs")), "an apartment for rent has no House customs box");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F21 CHECKS PASSED");
process.exit(failures ? 1 : 0);
