// A sign-in for the owner to try the LOCAL app (http://localhost:3100) by hand:
// owner@apptmasters.local / LocalTest-2026, with 2 saved listings and 2 unread
// messages from Sarah, so the counts and the red dot show. Test database only;
// run after seed-people.mjs and seed-marketplace.mjs. Re-runnable.
import fs from "node:fs";
import { createRequire } from "node:module";
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");
const bcrypt = require("bcryptjs");

const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const url = src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1];
if (!url.includes("_test")) throw new Error("not the test database");
const db = new pg.Client({ connectionString: url });
await db.connect();

const id = "local-owner";
const now = Date.now();
const ago = h => new Date(now - h * 3_600_000);
await db.query(`DELETE FROM "User" WHERE id = $1`, [id]);
await db.query(`INSERT INTO "User" (id, name, email, password, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,true,$5,$5)`,
  [id, "Owner Test", "owner@apptmasters.local", await bcrypt.hash("LocalTest-2026", 10), ago(24 * 30)]);
await db.query(`INSERT INTO "SavedListing" (id, "userId", "listingId") VALUES ('local-s1',$1,'shot-l1'), ('local-s2',$1,'shot-l4')`, [id]);
await db.query(`INSERT INTO "ListingMessage" (id, content, read, "listingId", "senderId", "receiverId", "createdAt") VALUES
  ('local-m1','Hi! Thanks for your interest in the apartment.', false, 'shot-l1', 'shot-owner', $1, $2),
  ('local-m2','It is still available. Would Saturday work for a visit?', false, 'shot-l1', 'shot-owner', $1, $3)`, [id, ago(3), ago(1)]);
await db.end();
console.log("local sign-in ready: owner@apptmasters.local / LocalTest-2026 (test database only)");
