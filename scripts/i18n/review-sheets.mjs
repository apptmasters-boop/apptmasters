// Review sheets for the native speakers (translation project, owner 2026-10-23): one CSV per
// language in docs/translations/, with where the text shows, the English, the translation and an
// empty "Correction" column. They open in Excel or Google Sheets (UTF-8 with a BOM, so accents and
// Arabic show correctly). Run after changing messages/*.json:
//   node scripts/i18n/review-sheets.mjs
import fs from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("docs/translations/", ROOT);
fs.mkdirSync(OUT, { recursive: true });

const WHERE = {
  meta: "Browser tab and search results",
  common: "Everywhere (buttons, loading)",
  language: "The language button and page",
  nav: "Menus (top bar, phone bar, side menu)",
  home: "Home page",
  homeQuestion: "Home: \"Have you found your new home?\"",
  landing: "Home page (signed out)",
  auth: "Sign up, log in, passwords",
  intent: "After confirming the email: \"What brings you…\"",
  more: "More page",
  settings: "Settings",
  bell: "Notifications bell",
  error: "Error page",
};
const NAMES = { fr: "French", es: "Spanish", ar: "Arabic" };

const load = l => JSON.parse(fs.readFileSync(new URL(`messages/${l}.json`, ROOT), "utf8"));
const flat = (tree, p = "") => Object.entries(tree).flatMap(([k, v]) => typeof v === "string" ? [[p + k, v]] : flat(v, `${p}${k}.`));
const cell = v => `"${String(v).replace(/"/g, '""')}"`;

const en = Object.fromEntries(flat(load("en")));
for (const l of Object.keys(NAMES)) {
  const tr = Object.fromEntries(flat(load(l)));
  const rows = [["Where", "English", NAMES[l], "Correction (leave empty if it is right)", "Key"]];
  for (const [key, english] of Object.entries(en)) {
    rows.push([WHERE[key.split(".")[0]] ?? key.split(".")[0], english, tr[key] ?? "", "", key]);
  }
  const csv = "﻿" + rows.map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
  fs.writeFileSync(new URL(`review-${l}.csv`, OUT), csv);
  console.log(`docs/translations/review-${l}.csv: ${rows.length - 1} texts`);
}
