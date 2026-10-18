// Fix F13: My Profile and the Settings pages each have their own page; every link leads to the right one.
// Needs seed-owner-login.mjs and seed-resident-login.mjs (test database only).
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const OUT = new URL("./outF13/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", e => { console.log("PAGE ERROR", e.message.slice(0, 200)); failures++; });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failures++; };
const shot = async (n, full = true) => { await wait(800); await page.screenshot({ path: fileURLToPath(new URL(`${n}.png`, OUT)), fullPage: full }); console.log("shot", n); };
const go = async p => { await page.goto(`${BASE}${p}`, { waitUntil: "networkidle2" }); await wait(800); };
const text = () => page.evaluate(() => document.querySelector("main")?.innerText ?? "");
const h1 = () => page.evaluate(() => document.querySelector("main h1")?.textContent.trim());
const visibleHref = sel => page.evaluate(s => [...document.querySelectorAll(s)].find(e => e.offsetParent !== null)?.getAttribute("href"), sel);

async function signIn(email) {
  await go("/login");
  await page.evaluate(() => localStorage.clear());
  await go("/login");
  await page.type("input[type=email]", email);
  await page.type("input[type=password]", "LocalTest-2026");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}), page.keyboard.press("Enter")]);
  await wait(1500);
}

// ---- The owner's local login (no Home), phone ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await signIn("owner@apptmasters.local");

await go("/more");
const account = await page.evaluate(() => {
  const section = [...document.querySelectorAll("main section")].find(s => s.querySelector("h2")?.textContent.trim() === "Account");
  return section ? [...section.querySelectorAll("a, button")].map(e => e.textContent.trim()) : [];
});
console.log("More › Account:", account.join(" | "));
ok(JSON.stringify(account) === JSON.stringify(["Settings", "How It Works", "Help & support", "Log out"]), "Account: Settings, How It Works, Help & support, Log out");
const groups = () => page.$$eval("main section h2", hs => hs.map(h => h.textContent.trim()));
ok(!(await groups()).includes("Messages"), "no Messages group without a Home: the phone bar has it (fix F14)");
ok(await page.$eval('nav[aria-label="Main"]', n => [...n.querySelectorAll("a")].some(a => a.getAttribute("href") === "/listings/inbox")), "the phone bar has Messages");
const moreText = await text();
ok(!/Personal information|Privacy & security/.test(moreText), "Personal information and Privacy & security are not on More");
ok(await page.$eval('main a[aria-label="Settings"]', a => a.getAttribute("href")) === "/settings", "the gear opens /settings");
ok(await page.evaluate(() => [...document.querySelectorAll("main a")].find(a => a.textContent.includes("View profile"))?.getAttribute("href")) === "/profile", "the profile card opens /profile");
await shot("more-m");

await page.click('main a[aria-label="Settings"]');
await wait(2000);
ok(new URL(page.url()).pathname === "/settings" && await h1() === "Settings", "the gear lands on Settings");
const settingsLinks = await page.$$eval("main a", as => as.map(a => [a.textContent.trim(), a.getAttribute("href")]).filter(([, h]) => h?.startsWith("/settings/")));
console.log("Settings rows:", settingsLinks.map(l => l[1]).join(" "));
ok(settingsLinks.length === 3 && ["personal-information", "notifications", "security"].every(p => settingsLinks.some(([, h]) => h === `/settings/${p}`)), "Settings has Personal information, Notifications, Login & security");
ok(await visibleHref('main a[aria-label="More"]') === "/more", "Settings goes back to More");
// Dark mode, right on Settings.
const darkBefore = await page.evaluate(() => document.documentElement.classList.contains("dark"));
await page.click('[role="switch"][aria-label="Dark mode"]'); await wait(400);
ok(await page.evaluate(() => document.documentElement.classList.contains("dark")) === !darkBefore, "the Dark mode switch flips the page");
await shot("settings-dark-m", false);
await page.click('[role="switch"][aria-label="Dark mode"]'); await wait(400);
ok(await page.evaluate(() => document.documentElement.classList.contains("dark")) === darkBefore, "and back");
await shot("settings-m");

// My Profile: who you are, nothing to change.
await go("/profile");
const profile = await text();
ok(await h1() === "My Profile", "My Profile");
ok(!/Change password|Push notifications|Two-step|Dark mode/.test(profile), "no password, notifications, two-step sign-in or Dark mode on My Profile");
ok(/No Home yet/.test(profile) && /Create a Home/.test(profile) && /Join a Home/.test(profile), "No Home yet, with Create / Join");
ok(!/Home details|Room/.test(profile), "no Home details for someone without a Home");
ok(await page.evaluate(() => [...document.querySelectorAll("main a")].find(a => a.textContent.trim() === "Edit")?.getAttribute("href")) === "/settings/personal-information?from=profile", "Edit opens Personal information");
await shot("profile-m");

// Personal information: change the name, save, still there after a reload; then put it back.
await go("/settings/personal-information");
ok(await h1() === "Personal information", "Personal information");
ok(await visibleHref('main a[aria-label="Settings"]') === "/settings", "goes back to Settings");
ok(!(await page.$("#home-details")), "no Home details for someone without a Home");
const original = await page.$eval("#pi-name", i => i.value);
async function saveName(name) {
  await page.click("#pi-name", { clickCount: 3 }); await page.keyboard.press("Backspace");
  await page.type("#pi-name", name);
  await page.evaluate(() => [...document.querySelectorAll("main button[type=submit]")].find(b => b.textContent.trim() === "Save").click());
  await wait(1500);
}
await saveName("Owner Tested");
ok((await text()).includes("Saved."), "Saved.");
await go("/settings/personal-information");
ok(await page.$eval("#pi-name", i => i.value) === "Owner Tested", "the new name is kept");
await shot("personal-m");
await saveName(original);
await go("/settings/personal-information?from=profile");
ok(await visibleHref('main a[aria-label="My Profile"]') === "/profile", "opened from My Profile, it goes back to My Profile");

// Notifications: each change saves on its own.
await go("/settings/notifications");
ok(await h1() === "Notifications", "Notifications");
const shopping = 'input[aria-label="Email for Shopping"]';
const before = await page.$eval(shopping, i => i.checked);
await page.click(shopping); await wait(1500);
await go("/settings/notifications");
ok(await page.$eval(shopping, i => i.checked) === !before, "Email for Shopping changed and saved without a Save button");
await page.click(shopping); await wait(1500);
await go("/settings/notifications");
ok(await page.$eval(shopping, i => i.checked) === before, "and back");
await shot("notifications-m");

// Login & security.
await go("/settings/security");
const security = await text();
ok(await h1() === "Login & security", "Login & security");
ok(/Change password/.test(security) && /Two-step sign-in/.test(security) && /Recent sign-ins/.test(security), "password, two-step sign-in, recent sign-ins");
ok(!/Push notifications|Dietary/.test(security), "nothing else on it");
await shot("security-m");

// ---- Computer: the trail and the name menu ----
await page.setViewport({ width: 1536, height: 1000 });
await go("/settings/notifications");
const trail = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Breadcrumb"]'); return n && n.offsetParent !== null ? n.innerText.replace(/\s+/g, " ").trim() : null; });
ok(trail === "Settings Notifications", `trail on a computer: ${trail}`);
await shot("notifications-d", false);
await go("/settings");
await shot("settings-d", false);
await go("/profile");
await shot("profile-d", false);
await go("/listings");
await page.evaluate(() => [...document.querySelectorAll("header button")].find(b => b.offsetParent !== null && b.getAttribute("aria-expanded") !== null)?.click());
await wait(500);
const menu = await page.$$eval("header a", as => as.map(a => [a.textContent.trim(), a.getAttribute("href")]));
ok(menu.some(([t, h]) => t === "Profile" && h === "/profile") && menu.some(([t, h]) => t === "Settings" && h === "/settings"), "name menu: Profile → /profile, Settings → /settings");
ok(!menu.some(([t]) => /Settings & notifications/.test(t)), "no more \"Settings & notifications\"");

// ---- Someone who lives in a Home, phone ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await signIn("resident@apptmasters.local");
await go("/profile");
const resident = await text();
ok(/Maple House/.test(resident) && /Household admin/.test(resident), "My Homes: Maple House, Household admin");
ok(/Home details/.test(resident) && /Room 2/.test(resident) && /September 1, 2026/.test(resident) && /Vegetarian/.test(resident), "Home details: Room 2, September 1, 2026, Vegetarian");
await shot("profile-resident-m");
await go("/settings/personal-information");
ok(!!(await page.$("#home-details")) && await page.$eval("#pi-room", i => i.value) === "Room 2", "Personal information has the Home details");
await shot("personal-resident-m");
// A new photo is saved as soon as it's uploaded (no Save needed); then it's taken off again.
const input = await page.$('input[type=file]');
await input.uploadFile(fileURLToPath(new URL("profile-resident-m.png", OUT)));
await wait(2500);
ok((await text()).includes("Photo saved."), "Photo saved.");
await go("/profile");
ok(/\?v=\d+$/.test(await page.$eval("main img", i => i.getAttribute("src")) ?? ""), "My Profile shows the new photo after a reload");
await page.evaluate(() => fetch("/api/users/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? sessionStorage.getItem("token")}` }, body: JSON.stringify({ photo: "" }) }));
await go("/more");
ok((await groups()).includes("Messages"), "in a Home, More keeps Messages: the household bar has no Messages tab (fix F14)");
await go("/apartment/local-home-maple/more");
const homeMore = await page.$$eval("a", as => as.map(a => a.getAttribute("href")));
ok(homeMore.includes("/profile") && homeMore.includes("/settings"), "the Home's More has My profile and Settings");
ok(homeMore.includes("/help"), "the Home's More has Help & support (phones have no footer, F16)");

await browser.close();
console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL F13 CHECKS PASSED");
process.exit(failures ? 1 : 0);
