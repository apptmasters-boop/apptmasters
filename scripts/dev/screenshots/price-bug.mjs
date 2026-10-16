// Reproduce: typing Min / Max in the filters and applying.
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
page.on("pageerror", e => console.log("PAGE ERROR", e.message.slice(0, 200)));
await page.setViewport({ width: 1536, height: 1000 });
await page.goto("http://localhost:3100/listings", { waitUntil: "networkidle2" });
await page.waitForSelector("input[aria-label='Minimum price'][inputmode='numeric']");
const min = await page.$("aside input[aria-label='Minimum price'][inputmode='numeric']");
await min.click(); await page.keyboard.type("1000", { delay: 80 });
const max = await page.$("aside input[aria-label='Maximum price'][inputmode='numeric']");
await max.click(); await page.keyboard.type("2000", { delay: 80 });
console.log("typed:", await page.$eval("aside input[aria-label='Minimum price'][inputmode='numeric']", e => e.value), await page.$eval("aside input[aria-label='Maximum price'][inputmode='numeric']", e => e.value));
await page.evaluate(() => [...document.querySelectorAll("aside button")].find(b => b.textContent.includes("Apply filters"))?.click());
await new Promise(r => setTimeout(r, 2500));
console.log("url after apply:", page.url());
console.log("heading:", await page.$eval("h1", e => e.textContent));
await browser.close();
