// The confirmation link of a sign-up on the LOCAL copy (it sends no email), for testing
// sign-up by hand (step O1): node scripts/dev/screenshots/confirm-link.mjs <email>
// Reads the local app's log (scripts/dev/screenshots/dev.log, where the app prints the link in
// development only). Test database / local copy only.
import fs from "node:fs";

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/dev/screenshots/confirm-link.mjs <email>"); process.exit(1); }
const log = new URL("./dev.log", import.meta.url);
if (!fs.existsSync(log)) { console.error("No local app log (scripts/dev/screenshots/dev.log): start the local app as in docs/HANDOFF.md."); process.exit(1); }

const prefix = `[email] confirmation link for ${email}: `;
const line = fs.readFileSync(log, "utf8").split(/\r?\n/).reverse().find(l => l.includes(prefix));
if (!line) { console.error(`No confirmation link for ${email} yet: sign up first (or use "Resend the link").`); process.exit(1); }
const url = line.slice(line.indexOf(prefix) + prefix.length).trim();
if (!url.startsWith("http://localhost")) { console.error("That link isn't for the local copy."); process.exit(1); }
console.log(url);
