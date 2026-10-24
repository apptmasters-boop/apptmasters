// Fix F1: clicks through every filter on the LOCAL app (port 3100, test database) and
// checks that the page address and the number of results shown match the search.
//   node filters-ui-check.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const OUT = new URL("./outF20/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
  args: ["--no-sandbox", "--no-first-run", "--disable-gpu"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)),
});
const page = await browser.newPage();
page.setDefaultTimeout(60_000);
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open(path = "/listings") {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.querySelectorAll("article").length > 0 || document.body.innerText.includes("No listings match"));
}
const params = () => new URL(page.url()).searchParams;
async function clickButton(text, within = "body") {
  const done = await page.evaluate((t, sel) => {
    const root = document.querySelector(sel) ?? document.body;
    const b = [...root.querySelectorAll("button")].find(x => x.offsetParent !== null && x.textContent.trim().replace(/\s+/g, " ") === t);
    if (b) b.click();
    return !!b;
  }, text, within);
  if (!done) { ok(false, `button "${text}" not found`); }
  await wait(300);
}
async function clickStartsWith(prefix, within = "body") {
  await page.evaluate((t, sel) => {
    const root = document.querySelector(sel) ?? document.body;
    [...root.querySelectorAll("button")].find(x => x.offsetParent !== null && x.textContent.trim().startsWith(t))?.click();
  }, prefix, within);
  await wait(300);
}
/** The number of results the page says, against the search API for the same address. */
async function countsMatch(label) {
  await page.waitForFunction(() => !document.body.innerText.includes("Searching…"));
  await wait(800);
  const shown = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h1")].map(h => h.textContent).find(t => /\d+ (place|places) in/.test(t));
    const sub = [...document.querySelectorAll("p")].map(p => p.textContent).find(t => /^\d+ listings?/.test(t));
    const m = (heading ?? sub ?? "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  });
  const api = await page.evaluate(async q => (await (await fetch(`/api/listings/search?${q}`)).json()).total, params().toString());
  ok(shown === api, `${label}: page shows ${shown}, search says ${api} (${params().toString() || "no filter"})`);
}
async function filtersWindow(action, label, check) {
  await open();
  await clickStartsWith("Filters");
  await page.waitForSelector("[role=dialog][aria-label=Filters]");
  await action();
  await clickStartsWith("Show", "[role=dialog][aria-label=Filters]");
  if (!(await page.$("[role=dialog][aria-label=Filters]"))) { /* closed: applied */ } else { await clickStartsWith("No listings match", "[role=dialog][aria-label=Filters]"); }
  await page.waitForFunction(() => !document.querySelector("[role=dialog][aria-label=Filters]"));
  ok(check(params()), `${label}: address ${params().toString()}`);
  await countsMatch(label);
}
const dialog = "[role=dialog][aria-label=Filters]";

for (const [size, viewport] of [["computer", { width: 1536, height: 1000 }], ["phone", { width: 390, height: 844, deviceScaleFactor: 2 }]]) {
  console.log(`\n--- ${size} ---`);
  await page.setViewport(viewport);
  await open();
  ok(!(await page.$("aside input[aria-label='Location']")), "no filter panel on the side");
  await countsMatch("no filter");

  // The quick buttons on top.
  // The Price button opens the same price range as Filters (fix F8).
  await clickStartsWith("Any price");
  ok(!!(await page.$("#quick-picker input[aria-label='Maximum price slider']")), "the Price button opens the price range");
  await page.type("#quick-picker input[aria-label='Minimum price']", "1,000");
  await page.type("#quick-picker input[aria-label='Maximum price']", "$2,000");
  await clickButton("Show");
  await wait(800);
  ok(params().get("minPrice") === "1000" && params().get("maxPrice") === "2000", `price box: ${params().toString()}`);
  await countsMatch("price min and max");
  await clickStartsWith("$1,000 – $2,000");
  await clickButton("Any price");
  await wait(800);
  ok(!params().get("minPrice") && !params().get("maxPrice"), "Any price removes it");

  await open();
  await clickStartsWith("Any price");
  await page.type("#quick-picker input[aria-label='Minimum price']", "3000");
  await page.type("#quick-picker input[aria-label='Maximum price']", "500");
  await clickButton("Show");
  await wait(800);
  ok(params().get("minPrice") === "500" && params().get("maxPrice") === "3000", `min above max swapped: ${params().toString()}`);

  // Dragging the right handle (here with the keyboard: 60 steps of $50 down from $5,000+).
  await open();
  await clickStartsWith("Any price");
  await page.focus("#quick-picker input[aria-label='Maximum price slider']");
  for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowLeft");
  await clickButton("Show");
  await wait(800);
  ok(params().get("maxPrice") === "2000" && !params().get("minPrice"), `slider to $2,000: ${params().toString()}`);
  await countsMatch("slider up to $2,000");

  await open();
  await clickStartsWith("People"); await clickButton("2"); await wait(800);
  ok(params().get("occupants") === "2", "people: 2"); await countsMatch("2 people");
  await open();
  await clickStartsWith("Any bedrooms"); await clickButton("2"); await wait(800);
  ok(params().get("bedrooms") === "2", "bedrooms: 2"); await countsMatch("2 bedrooms");
  await open();
  // No "Anywhere" button any more (fix F3): the place is set in Filters, and shows as a removable chip.
  ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.offsetParent && b.textContent.trim().startsWith("Anywhere")))), "no Anywhere button");
  await clickStartsWith("Filters");
  await page.waitForSelector("[role=dialog][aria-label=Filters]");
  await page.type("[role=dialog] input[aria-label='Location']", "Brooklyn");
  await clickStartsWith("Show", "[role=dialog][aria-label=Filters]");
  await wait(800);
  ok(params().get("q") === "Brooklyn", "place: Brooklyn"); await countsMatch("Brooklyn");
  await clickButton("Brooklyn"); await wait(800);
  ok(!params().get("q"), "the Brooklyn chip removes the place");
  await open();
  await clickStartsWith("Move-in date");
  const date = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await page.$eval("#quick-move-in", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, date);
  await clickButton("Show listings"); await wait(800);
  ok(params().get("moveIn") === date, `move-in: ${params().get("moveIn")}`); await countsMatch("move-in date");

  // The tabs.
  await open(); await clickStartsWith("Rooms ("); await wait(800);
  ok(params().get("kind") === "room", "tab Rooms"); await countsMatch("tab Rooms");

  // F20: the order (deal-breakers first), Pets & smoking, the room lifestyle only for rooms, More filters.
  const headings = () => page.$$eval(`${dialog} h3`, hs => hs.filter(h => h.offsetParent !== null).map(h => h.textContent.trim()));
  const ORDER = ["Location", "Property type", "Price range", "Fees", "Move-in date", "Lease duration", "Number of occupants", "Bedrooms",
    "Pets & smoking", "Additional options", "What matters to you?"];
  await open(); await clickStartsWith("Filters"); await page.waitForSelector(dialog);
  const shown = await headings();
  ok(JSON.stringify(shown) === JSON.stringify(ORDER), `the order: ${shown.join(" · ")}`);
  const moreText = () => page.$$eval(`${dialog} button[aria-controls=more-filters]`, bs => bs.map(b => `${b.textContent.trim()}|${b.getAttribute("aria-expanded")}`)[0] ?? "");
  ok((await moreText()).startsWith("More filters") && (await moreText()).endsWith("|false"), `More filters, folded: ${await moreText()}`);
  ok(!(await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].some(b => b.offsetParent && b.textContent.trim() === "Pet friendly"))), "no Pet friendly in Additional options");
  await clickStartsWith("More filters", dialog);
  const opened = await headings();
  ok(JSON.stringify(opened.slice(-3)) === JSON.stringify(["Bathrooms", "Size", "Listed"]), `More filters opens: ${opened.slice(-3).join(" · ")}`);
  await clickButton("Apartment", dialog);
  ok(!(await headings()).includes("What matters to you?"), "Apartment: no room lifestyle");
  await clickButton("House", dialog);
  ok(!(await headings()).includes("What matters to you?"), "House: no room lifestyle");
  await clickButton("Room", dialog);
  ok((await headings()).includes("What matters to you?"), "Room: the room lifestyle is back");
  await clickButton("All", dialog);
  ok((await headings()).includes("What matters to you?"), "All: the room lifestyle shows");
  await page.screenshot({ path: fileURLToPath(new URL(`f20-filters-${size}.png`, OUT)), fullPage: false }); console.log(`shot f20-filters-${size}`);
  await page.evaluate(() => document.querySelector("[aria-label='Close filters']")?.click());
  await wait(300);

  // Every filter in the Filters window.
  const pill = text => () => clickButton(text, dialog);
  const inMore = text => async () => { await clickStartsWith("More filters", dialog); await clickButton(text, dialog); };
  await filtersWindow(pill("Room"), "property type Room", p => p.get("kind") === "room");
  await filtersWindow(async () => { await clickButton("Room", dialog); await clickButton("Private room", dialog); }, "private room", p => p.get("roomType") === "PRIVATE_ROOM");
  await filtersWindow(pill("House"), "property type House", p => p.get("kind") === "house");
  await filtersWindow(async () => {
    await page.type(`${dialog} input[aria-label='Minimum price']`, "1,000");
    await page.type(`${dialog} input[aria-label='Maximum price']`, "2,500");
  }, "price boxes in Filters", p => p.get("minPrice") === "1000" && p.get("maxPrice") === "2500");
  await filtersWindow(pill("3+"), "bedrooms 3+", p => p.get("bedrooms") === "3+");
  await filtersWindow(pill("Studio"), "studio", p => p.get("bedrooms") === "0");
  await filtersWindow(pill("4"), "4 people", p => p.get("occupants") === "4");
  await filtersWindow(inMore("2+"), "2+ bathrooms", p => p.get("bathrooms") === "2");
  // A filter set under More filters: it opens by itself, with the count.
  await clickStartsWith("Filters"); await page.waitForSelector(dialog);
  ok((await moreText()).startsWith("More filters (1)") && (await moreText()).endsWith("|true"),`More filters opens by itself when one is set: ${await moreText()}`);
  await page.evaluate(() => document.querySelector("[aria-label='Close filters']")?.click()); await wait(300);
  await filtersWindow(inMore("750+"), "750+ sq ft", p => p.get("minSqft") === "750");
  await filtersWindow(pill("Month-to-month"), "month-to-month", p => p.get("lease") === "0");
  await filtersWindow(pill("12 months or more"), "12 months or more", p => p.get("lease") === "12");
  await filtersWindow(pill("Pets allowed"), "pets allowed (Pets & smoking)", p => (p.get("amenities") ?? "").split(",").includes("petsAllowed"));
  for (const [label, key] of [["Furnished", "furnished"], ["Parking", "parking"], ["Wi-Fi", "internetIncluded"],
    ["Air conditioning", "airConditioning"], ["Elevator", "elevator"], ["Heat included", "heatIncluded"], ["Dishwasher", "dishwasher"],
    ["Utilities included", "utilitiesIncluded"], ["Private bathroom", "privateBathroom"], ["Accessible", "accessible"]]) {
    await filtersWindow(pill(label), label, p => (p.get("amenities") ?? "").split(",").includes(key));
  }
  await filtersWindow(pill("Laundry"), "laundry", p => p.get("laundry") === "1");
  await filtersWindow(pill("Smoke-free"), "smoke-free", p => p.get("smoking") === "free");
  await filtersWindow(pill("Allowed"), "smoking allowed", p => p.get("smoking") === "allowed");
  await filtersWindow(pill("No broker fee"), "no broker fee", p => p.get("noBrokerFee") === "1");
  await filtersWindow(pill("No application fee"), "no application fee", p => p.get("noApplicationFee") === "1");
  await filtersWindow(inMore("Last 7 days"), "listed in the last 7 days", p => p.get("listedWithin") === "7");
  // What matters to you? (fix F5): a roommate choice also selects Room.
  await filtersWindow(pill("Quiet home"), "Quiet home", p => p.get("roommateLifestyleTag") === "quiet-household" && p.get("kind") === "room");
  await filtersWindow(async () => { await clickButton("Night owl", dialog); await clickButton("Apartment", dialog); },
    "Apartment clears the roommate choice", p => p.get("kind") === "apartment" && !p.get("roommateLifestyleTag"));
  await filtersWindow(async () => {
    await clickButton("Furnished", dialog); await clickButton("Wi-Fi", dialog);
    // The "2" under Number of occupants (Bedrooms has a "2" too).
    await page.evaluate(() => [...document.querySelectorAll("[role=dialog] section")].find(s => s.querySelector("h3")?.textContent === "Number of occupants")
      ?.querySelectorAll("button").forEach(b => { if (b.textContent.trim() === "2") b.click(); }));
    await wait(300);
  },
    "several together", p => p.get("occupants") === "2" && p.get("amenities") === "furnished,internetIncluded");

  // Sorting.
  for (const [value, label] of [["price_asc", "price low to high"], ["price_desc", "price high to low"]]) {
    await open();
    await page.evaluate(v => { const s = [...document.querySelectorAll("select[aria-label='Sort by']")].find(x => x.offsetParent !== null || x.getClientRects().length); s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }, value);
    await wait(1000);
    const prices = await page.evaluate(() => [...document.querySelectorAll("article")].filter(a => a.offsetParent !== null).map(a => Number((a.innerText.match(/\$([\d,]+)\/(mo|month)/) ?? [])[1]?.replace(/,/g, ""))));
    const inOrder = prices.every((p, i) => i === 0 || (value === "price_asc" ? prices[i - 1] <= p : prices[i - 1] >= p));
    ok(params().get("sort") === value && inOrder, `sort ${label}: ${prices.join(", ")}`);
  }
}

await browser.close();
console.log(`\n${failures === 0 ? "ALL FILTER CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
