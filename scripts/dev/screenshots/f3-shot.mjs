// Fix F3: the results' top row without "Anywhere", and the place as a chip.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
const OUT = new URL("./outF3/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"], userDataDir: fileURLToPath(new URL("./profile", import.meta.url)) });
const page = await browser.newPage();
for (const [name, vp, path] of [["results-d", { width: 1536, height: 700 }, "/listings"], ["brooklyn-d", { width: 1536, height: 700 }, "/listings?q=Brooklyn"], ["brooklyn-m", { width: 390, height: 844, deviceScaleFactor: 2 }, "/listings?q=Brooklyn"]]) {
  await page.setViewport(vp);
  await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.querySelectorAll("article").length > 0);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) });
  console.log("shot", name);
}
await browser.close();
