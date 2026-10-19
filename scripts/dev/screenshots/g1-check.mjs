// Step G1 (owner, 2026-10-18): a listing's photos rotate every 4 seconds, pause under the mouse,
// stop for good once the person takes over (arrow, thumbnail, swipe), can be paused, don't move
// with "Reduce motion", and a one-photo listing has no controls. Local test data only:
// it (re)creates two of Jordan's listings, "local-listing-gallery" (3 pictures) and
// "local-listing-single" (1 picture). Run seed-resident-login.mjs first.
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
if (!BASE.includes("localhost")) throw new Error("local only: it creates test listings");
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const OUT = new URL("./outG1/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };

// Three different pictures: screenshots from earlier checks, copied into the (git-ignored) uploads.
const samples = ["./outF13/settings-m.png", "./outL2/conversation-closed-m.png", "./outO1/welcome-m.png"].map(p => fileURLToPath(new URL(p, import.meta.url)));
if (!samples.every(p => fs.existsSync(p))) throw new Error("run f13-check, l2-check and o1-check once first (they make the sample pictures)");
fs.mkdirSync(fileURLToPath(new URL("public/uploads/listings/", PROJECT)), { recursive: true });
const urls = samples.map(src => { const url = `/uploads/listings/${randomUUID()}.png`; fs.copyFileSync(src, fileURLToPath(new URL(`public${url}`, PROJECT))); return url; });

const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const db = new pg.Client({ connectionString: src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1] });
await db.connect();
for (const [id, title, photos] of [["local-listing-gallery", "Bright apartment with three photos", urls], ["local-listing-single", "Cozy studio with one photo", [urls[0]]]]) {
  const old = (await db.query(`SELECT url FROM "ListingPhoto" WHERE "listingId" = $1`, [id])).rows.map(r => r.url);
  await db.query(`DELETE FROM "Listing" WHERE id = $1`, [id]);
  for (const u of old) if (/^\/uploads\/listings\/[0-9a-f-]{36}\.png$/.test(u) && !urls.includes(u)) fs.rmSync(fileURLToPath(new URL(`public${u}`, PROJECT)), { force: true });
  await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, neighborhood, bedrooms, "maxOccupants", "ownerId", "createdAt", "updatedAt")
    VALUES ($1,'APARTMENT_FOR_RENT','APPROVED',$2,'Test listing for the photo carousel.',1800,'Brooklyn','Park Slope',1,2,'local-roommate',now(),now())`, [id, title]);
  for (const [i, u] of photos.entries()) await db.query(`INSERT INTO "ListingPhoto" (id, url, position, "listingId") VALUES ($1,$2,$3,$4)`, [randomUUID(), u, i, id]);
}
await db.end();

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
const counter = () => page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="carousel"] span')].map(s => s.textContent.trim()).find(t => /^\d+ \/ \d+$/.test(t)) ?? null);
const label = sel => page.$eval(sel, b => b.getAttribute("aria-label")).catch(() => null);
const away = () => page.mouse.move(5, 5);
const open = async id => { await page.goto(`${BASE}/listings/${id}`, { waitUntil: "networkidle2" }); await page.waitForSelector('[aria-roledescription="carousel"], main img', { timeout: 60_000 }); await away(); await wait(300); };

// Computer.
await page.setViewport({ width: 1536, height: 1000 });
await open("local-listing-gallery");
ok(await counter() === "1 / 3", "starts on 1 / 3");
await wait(4600);
ok(await counter() === "2 / 3", `after 4 seconds, by itself: ${await counter()}`);
await page.screenshot({ path: fileURLToPath(new URL("listing-d.png", OUT)) }); console.log("shot listing-d");
// Under the mouse it waits.
const box = await (await page.$('[aria-roledescription="carousel"]')).boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
const held = await counter();
await wait(5000);
ok(await counter() === held, "under the mouse it waits");
await away(); await wait(4600);
ok(await counter() !== held, "the mouse leaves: it goes on");
// Pause / play.
await page.click('button[aria-label="Pause photos"]'); await away();
const paused = await counter();
await wait(5000);
ok(await counter() === paused && await label('[aria-roledescription="carousel"] button[aria-label="Play photos"]') === "Play photos", "Pause stops it; the button turns to Play");
await page.click('button[aria-label="Play photos"]'); await away(); await wait(4600);
ok(await counter() !== paused, "Play starts it again");
// Taking over: the arrow stops it for good.
const before = await counter();
await page.click('button[aria-label="Next photo"]'); await away();
const chosen = await counter();
ok(chosen !== before, `› shows the next photo: ${before} → ${chosen}`);
await wait(5000);
ok(await counter() === chosen, "after › it doesn't rotate any more");
// A thumbnail.
await page.click('button[aria-label="Photo 1"]'); await wait(300);
ok(await counter() === "1 / 3", "a thumbnail shows that photo");
// Arrow keys.
await page.focus('[aria-roledescription="carousel"]'); await page.keyboard.press("ArrowRight"); await wait(300);
ok(await counter() === "2 / 3", "the right arrow key shows the next photo");

// Phone: swipe.
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await open("local-listing-gallery");
ok(!(await page.$eval('button[aria-label="Next photo"]', b => b.offsetParent !== null)), "phone: no arrows (swipe instead)");
const pbox = await (await page.$('[aria-roledescription="carousel"]')).boundingBox();
const y = pbox.y + pbox.height / 2;
await page.touchscreen.touchStart(pbox.x + pbox.width * 0.8, y);
await page.touchscreen.touchMove(pbox.x + pbox.width * 0.2, y);
await page.touchscreen.touchEnd();
await wait(400);
ok(await counter() === "2 / 3", `phone: swiping left shows the next photo (${await counter()})`);
await wait(5000);
ok(await counter() === "2 / 3", "phone: after a swipe it doesn't rotate any more");
await page.screenshot({ path: fileURLToPath(new URL("listing-m.png", OUT)) }); console.log("shot listing-m");

// Reduce motion: no rotation.
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await open("local-listing-gallery");
await wait(5000);
ok(await counter() === "1 / 3", "with Reduce motion it doesn't move");
await page.emulateMediaFeatures([]);

// One photo: no controls.
await open("local-listing-single");
ok(!(await page.$('[aria-roledescription="carousel"]')) && !(await page.$('button[aria-label="Pause photos"]')) && !(await page.$('button[aria-label="Next photo"]')), "one photo: no rotation, no controls");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL G1 CHECKS PASSED");
process.exit(failures ? 1 : 0);
