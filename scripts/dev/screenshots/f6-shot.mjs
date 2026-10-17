// Fix F6: the Home search box label.
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
await page.setViewport({ width: 1536, height: 900 });
await page.goto("http://localhost:3100/login", { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
await page.waitForSelector("#lp-city");
console.log("label:", await page.$eval("label[for=lp-city]", e => e.textContent), "| placeholder:", await page.$eval("#lp-city", e => e.placeholder));
await page.screenshot({ path: fileURLToPath(new URL("./outF5/home-label-d.png", import.meta.url)), clip: { x: 0, y: 390, width: 1536, height: 130 } });
await browser.close();
