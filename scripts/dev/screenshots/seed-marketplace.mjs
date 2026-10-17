// Made-up Find a Home data (6 listings, saved listings, conversations) in the LOCAL TEST database,
// for screenshots. Run after seed-people.mjs. Re-runnable; refuses anything but a "_test" database.
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

const now = Date.now();
const ago = h => new Date(now - h * 3_600_000);
const listings = [
  { id: "shot-l1", type: "APARTMENT_FOR_RENT", title: "Spacious 2 bedroom in Brooklyn", price: 1800, city: "Brooklyn", state: "NY", zip: "11216", hood: "Prospect Heights", bd: 2, ba: 1, max: 4, prop: "APARTMENT", furn: true, wifi: true, laundry: "IN_UNIT", elevator: true, broker: 0, app: 50, lease: 12, avail: "2026-11-01", age: 20 },
  { id: "shot-l2", type: "ROOM_TO_SHARE", title: "Private room near Prospect Park", price: 950, city: "Brooklyn", state: "NY", zip: "11225", hood: "Flatbush", bd: 1, ba: 1, max: 2, prop: "APARTMENT", room: "PRIVATE_ROOM", furn: true, wifi: true, pets: true, broker: 0, app: 0, lease: 6, avail: "2026-10-15", age: 30 },
  { id: "shot-l3", type: "APARTMENT_FOR_RENT", title: "Modern apartment in Queens", price: 2200, city: "Queens", state: "NY", zip: "11101", hood: "Long Island City", bd: 3, ba: 2, max: 5, prop: "APARTMENT", furn: true, laundry: "IN_BUILDING", elevator: true, util: true, broker: 1500, app: 75, lease: 12, avail: "2026-11-05", age: 80 },
  { id: "shot-l4", type: "ROOM_TO_SHARE", title: "Bright room in Bushwick", price: 1400, city: "Brooklyn", state: "NY", zip: "11237", hood: "Bushwick", bd: 1, ba: 1, max: 2, prop: "HOUSE", room: "PRIVATE_ROOM", furn: true, wifi: true, util: true, broker: 0, lease: 0, avail: "2026-10-20", age: 100 },
  { id: "shot-l5", type: "APARTMENT_FOR_RENT", title: "Beautiful 3 bedroom brownstone", price: 2500, city: "Brooklyn", state: "NY", zip: "11238", hood: "Clinton Hill", bd: 3, ba: 2, max: 5, prop: "HOUSE", furn: false, parking: true, pets: true, laundry: "IN_UNIT", broker: 0, app: 0, lease: 12, avail: "2026-11-01", age: 6 },
  { id: "shot-l6", type: "ROOM_TO_SHARE", title: "Cozy shared room in Crown Heights", price: 850, city: "Brooklyn", state: "NY", zip: "11213", hood: "Crown Heights", bd: 1, ba: 1, max: 1, prop: "APARTMENT", room: "SHARED_ROOM", wifi: true, util: true, access: true, broker: 0, app: 0, lease: 3, avail: null, age: 2 },
];
await db.query(`DELETE FROM "Listing" WHERE id = ANY($1)`, [listings.map(l => l.id)]);
for (const l of listings) {
  await db.query(`INSERT INTO "Listing" (id, type, status, title, description, price, city, state, address, "zipCode", neighborhood, bedrooms, bathrooms, "maxOccupants", "propertyType", "roomType",
      furnished, "internetIncluded", "utilitiesIncluded", laundry, parking, elevator, "petsAllowed", "smokingAllowed", accessible, "brokerFee", "applicationFee", "leaseMonths", "availableFrom", "ownerId", "createdAt", "updatedAt")
    VALUES ($1,$2,'APPROVED',$3,$4,$5,$6,$7,'123 Prospect Ave, Apt 3B',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,false,$22,$23,$24,$25,$26,'shot-owner',$27,$27)`,
    [l.id, l.type, l.title, "Bright and spacious, in a quiet building close to the subway, grocery stores, restaurants and the park. Perfect for students or young professionals. Flexible lease terms; utilities are easy to set up and the landlord lives nearby and answers quickly.",
      l.price, l.city, l.state, l.zip, l.hood, l.bd, l.ba, l.max, l.prop, l.room ?? null, l.furn ?? null, l.wifi ?? null, l.util ?? null, l.laundry ?? null, l.parking ?? null, l.elevator ?? null, l.pets ?? null, l.access ?? null,
      l.broker ?? null, l.app ?? null, l.lease ?? null, l.avail ? new Date(`${l.avail}T00:00:00Z`) : null, ago(l.age)]);
  for (let i = 0; i < 3; i++) await db.query(`INSERT INTO "ListingPhoto" (id, url, position, "listingId") VALUES ($1, '/landing/hero.png', $2, $3)`, [`${l.id}-p${i}`, i, l.id]);
}
// Roommate lifestyle on the rooms ("What matters to you?" in Filters, fix F5).
await db.query(`UPDATE "Listing" SET "roommateLifestyleTags" = $2 WHERE id = $1`, ["shot-l2", JSON.stringify(["quiet-household", "non-smoker", "student-friendly"])]);
await db.query(`UPDATE "Listing" SET "roommateLifestyleTags" = $2 WHERE id = $1`, ["shot-l4", JSON.stringify(["night-owl", "pet-friendly"])]);
await db.query(`UPDATE "Listing" SET "roommateLifestyleTags" = $2 WHERE id = $1`, ["shot-l6", JSON.stringify(["quiet-household", "early-riser"])]);
// The details added in Sprint 13d.
await db.query(`UPDATE "Listing" SET "squareFeet" = 850, "airConditioning" = true, "heatIncluded" = true, dishwasher = true WHERE id = 'shot-l1'`);
await db.query(`INSERT INTO "SavedListing" (id, "userId", "listingId") VALUES ('shot-s1','shot-me','shot-l1'), ('shot-s2','shot-me','shot-l3'), ('shot-s3','shot-me','shot-l2'), ('shot-s4','shot-me','shot-l5')`);
const msgs = [
  ["shot-me", "shot-owner", "Hi Sarah! Is the apartment still available for November?", 50],
  ["shot-owner", "shot-me", "Hi! Yes, the apartment is still available. Would you like to visit this week?", 46],
  ["shot-me", "shot-owner", "Yes, I'm very interested. Is Saturday possible?", 45],
  ["shot-owner", "shot-me", "Sure! The next available slot is Saturday at 2 PM. Does that work for you?", 2],
];
for (const [i, [from, to, text, h]] of msgs.entries()) {
  await db.query(`INSERT INTO "ListingMessage" (id, content, read, "listingId", "senderId", "receiverId", "createdAt") VALUES ($1,$2,$3,'shot-l1',$4,$5,$6)`, [`shot-lm${i}`, text, i < 3, from, to, ago(h)]);
}
await db.query(`INSERT INTO "ListingMessage" (id, content, read, "listingId", "senderId", "receiverId", "createdAt") VALUES ('shot-lm9','Thanks for your interest! The rent is $950 and utilities are included.', false, 'shot-l2', 'shot-owner', 'shot-me', $1)`, [ago(20)]);
await db.query(`INSERT INTO "ListingMessage" (id, content, read, "listingId", "senderId", "receiverId", "createdAt") VALUES ('shot-lm8','Hello, is the room still free?', true, 'shot-l2', 'shot-me', 'shot-owner', $1)`, [ago(22)]);
await db.end();
console.log("seeded sprint 12");
