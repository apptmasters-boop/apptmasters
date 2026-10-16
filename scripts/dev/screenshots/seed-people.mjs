// Made-up people, a household and a listing in the LOCAL TEST database, for screenshots. Re-runnable.
// Refuses to run unless the database name contains "_test".
import fs from "node:fs";
import { createRequire } from "node:module";
// The repository root (this file is in scripts/dev/screenshots/).
const PROJECT = new URL("../../../", import.meta.url);
const require = createRequire(new URL("package.json", PROJECT));
const pg = require("pg");

const src = fs.readFileSync(new URL("tests/test-db.ts", PROJECT), "utf8");
const url = src.match(/"(postgresql:\/\/[^"]+apptmasters_test[^"]*)"/)[1];
if (!url.includes("_test")) throw new Error("not the test database");
const db = new pg.Client({ connectionString: url });
await db.connect();

const now = new Date();
const ago = d => new Date(now.getTime() - d * 86_400_000);
const users = [
  ["shot-me", "Jordan Lee", "shots-me@example.com"],
  ["shot-owner", "Sarah Miller", "shots-owner@example.com"],
  ["shot-admin", "Alex Kim", "shots-admin@example.com"],
  ["shot-mate1", "Priya Shah", "shots-mate1@example.com"],
  ["shot-mate2", "Marcus Bell", "shots-mate2@example.com"],
];
await db.query(`DELETE FROM "Apartment" WHERE "inviteCode" IN ('SHOT42') OR name = 'Prospect Park Place'`);
await db.query(`DELETE FROM "User" WHERE id = ANY($1)`, [users.map(u => u[0])]);
for (const [id, name, email] of users) {
  await db.query(`INSERT INTO "User" (id, name, email, password, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,'x',true,$4,$4)`, [id, name, email, ago(20)]);
}
await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, state, address, bedrooms, bathrooms, "ownerId", "createdAt", "updatedAt")
  VALUES ('shot-listing','APARTMENT_FOR_RENT','APPROVED','Spacious 2 bedroom in Brooklyn','Bright and quiet.',1800,'Brooklyn','NY','123 Prospect Ave',2,1,'shot-owner',$1,$1)`, [ago(10)]);
await db.query(`INSERT INTO "ListingMessage" (id, content, "listingId", "senderId", "receiverId", "createdAt") VALUES ('shot-msg','Is it still available?','shot-listing','shot-me','shot-owner',$1)`, [ago(5)]);
await db.query(`INSERT INTO "Apartment" (id, name, address, "inviteCode", "createdAt", "updatedAt") VALUES ('shot-home','Prospect Park Place','123 Prospect Ave, Brooklyn, NY 11216','SHOT42',$1,$1)`, [ago(30)]);
for (const [i, uid] of ["shot-admin", "shot-mate1", "shot-mate2"].entries()) {
  await db.query(`INSERT INTO "ApartmentMember" (id, role, status, "joinedAt", "userId", "apartmentId") VALUES ($1,$2,'ACTIVE',$3,$4,'shot-home')`,
    [`shot-m${i}`, i === 0 ? "ADMIN" : "MEMBER", ago(30 - i), uid]);
}
await db.end();
console.log("seeded people and the household");
