const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.resolve(process.cwd(), "dev.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const email = process.env.SEED_USER_EMAIL || "demo@apptmasters.local";
const password = process.env.SEED_USER_PASSWORD || "Password123!";
const userName = process.env.SEED_USER_NAME || "Demo User";
const apartmentName = process.env.SEED_APARTMENT_NAME || "Demo Apartment";
const inviteCode = process.env.SEED_APARTMENT_CODE || "DEMO1234";

const existingUser = db.prepare("SELECT id FROM User WHERE email = ?").get(email);
if (existingUser) {
  console.log(`User ${email} already exists. No changes were made.`);
  db.close();
  process.exit(0);
}

const userId = crypto.randomUUID();
const apartmentId = crypto.randomUUID();
const membershipId = crypto.randomUUID();
const now = new Date().toISOString();
const hashedPassword = bcrypt.hashSync(password, 10);

const insertUser = db.prepare(`
  INSERT INTO User (id, name, email, password, photo, roomAssignment, moveInDate, dietaryFlags, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, NULL, NULL, NULL, '[]', ?, ?)
`);
const insertApartment = db.prepare(`
  INSERT INTO Apartment (id, name, inviteCode, announcement, announcementAt, createdAt, updatedAt)
  VALUES (?, ?, ?, NULL, NULL, ?, ?)
`);
const insertMembership = db.prepare(`
  INSERT INTO ApartmentMember (id, role, status, joinedAt, movedOutAt, userId, apartmentId)
  VALUES (?, ?, ?, ?, NULL, ?, ?)
`);

const transaction = db.transaction(() => {
  insertUser.run(userId, userName, email, hashedPassword, now, now);
  insertApartment.run(apartmentId, apartmentName, inviteCode, now, now);
  insertMembership.run(membershipId, "ADMIN", "ACTIVE", now, userId, apartmentId);
});

transaction();

db.close();

console.log("Seed data created successfully.");
console.log(`  email: ${email}`);
console.log(`  password: ${password}`);
console.log(`  apartment invite code: ${inviteCode}`);
console.log("Now sign in at http://localhost:3000/login");
