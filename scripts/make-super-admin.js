#!/usr/bin/env node
// Usage: node scripts/make-super-admin.js email@example.com
const Database = require("better-sqlite3");
const path = require("path");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-super-admin.js email@example.com");
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), "dev.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const user = db.prepare("SELECT id, name, systemRole FROM User WHERE email = ?").get(email);
if (!user) {
  console.error(`No user found with email: ${email}`);
  db.close();
  process.exit(1);
}

if (user.systemRole === "SUPER_ADMIN") {
  console.log(`${user.name} (${email}) is already a Super Admin.`);
  db.close();
  process.exit(0);
}

db.prepare("UPDATE User SET systemRole = 'SUPER_ADMIN', updatedAt = ? WHERE email = ?")
  .run(new Date().toISOString(), email);

console.log(`✓ ${user.name} (${email}) has been granted Super Admin.`);
console.log("They will see the Admin Panel on the dashboard after their next login.");
db.close();
