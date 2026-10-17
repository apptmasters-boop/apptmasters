// Fix F12: the footer with only Help, and no Next.js "N" button on the local copy.
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
await page.setViewport({ width: 1536, height: 900 });
await page.goto("http://localhost:3100/listings", { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0);
await new Promise(r => setTimeout(r, 1500));
const devButton = await page.evaluate(() => { const p = document.querySelector("nextjs-portal"); const r = p?.shadowRoot; return !!r && [...r.querySelectorAll("button, [data-nextjs-dev-tools-button]")].some(b => b.getBoundingClientRect().width > 0); });
console.log(devButton ? "FAIL the N button is still there" : "ok   no N button");
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: fileURLToPath(new URL("./outF2/footer-only-help-d.png", import.meta.url)) });
await browser.close();
