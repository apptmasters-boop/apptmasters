// Fix F11: no "More Than Just a Place" on the signed-out Home.
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
await page.setViewport({ width: 1536, height: 1000 });
await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" }); await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Latest listings"));
const text = await page.evaluate(() => document.body.innerText);
const gone = ["More Than Just a Place", "Get Mentorship", "Build Friendships", "Grow Your Future", "Join the community"].filter(t => text.includes(t));
const headings = await page.$$eval("main h2", hs => hs.map(h => h.textContent.trim()));
console.log("sections:", headings.join(" | "));
console.log(gone.length ? `FAIL still shown: ${gone.join(", ")}` : "ok   the community section is gone");
await page.screenshot({ path: fileURLToPath(new URL("./outF7/home-full-d.png", import.meta.url)), fullPage: true });
await browser.close();
