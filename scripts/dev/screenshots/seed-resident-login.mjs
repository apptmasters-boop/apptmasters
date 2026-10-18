// A sign-in for the owner to try the LOCAL app (http://localhost:3100) as
// someone who lives in a Home (fix F13): resident@apptmasters.local /
// LocalTest-2026, admin of the test Home "Maple House", with a room, a
// move-in date and a dietary need on their profile. Their roommate (fix F15):
// roommate@apptmasters.local / LocalTest-2026, "Jordan". Test database only.
// Re-runnable: it starts the Home over (no expenses or payments).
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

const id = "local-resident";
const home = "local-home-maple";
const now = new Date();
const roommate = "local-roommate";
await db.query(`DELETE FROM "User" WHERE id IN ($1, $2)`, [id, roommate]);
await db.query(`DELETE FROM "Apartment" WHERE id = $1`, [home]);
await db.query(`INSERT INTO "User" (id, name, email, password, "emailVerified", "roomAssignment", "moveInDate", "dietaryFlags", "createdAt", "updatedAt")
  VALUES ($1,$2,$3,$4,true,'Room 2','2026-09-01T00:00:00Z','["VEGETARIAN"]',$5,$5)`,
  [id, "Riley Resident", "resident@apptmasters.local", await bcrypt.hash("LocalTest-2026", 10), new Date(now.getTime() - 60 * 86_400_000)]);
await db.query(`INSERT INTO "Apartment" (id, name, "inviteCode", "createdAt", "updatedAt") VALUES ($1,'Maple House','LOCALMAPLE',$2,$2)`, [home, now]);
await db.query(`INSERT INTO "ApartmentMember" (id, role, status, "userId", "apartmentId") VALUES ('local-member-maple','ADMIN','ACTIVE',$1,$2)`, [id, home]);
await db.query(`INSERT INTO "User" (id, name, email, password, "emailVerified", "createdAt", "updatedAt") VALUES ($1,'Jordan Roommate','roommate@apptmasters.local',$2,true,$3,$3)`,
  [roommate, await bcrypt.hash("LocalTest-2026", 10), new Date(now.getTime() - 50 * 86_400_000)]);
await db.query(`INSERT INTO "ApartmentMember" (id, role, status, "userId", "apartmentId") VALUES ('local-member-maple-2','MEMBER','ACTIVE',$1,$2)`, [roommate, home]);
await db.end();
console.log("local sign-ins ready: resident@ and roommate@apptmasters.local / LocalTest-2026, in Maple House (test database only)");
