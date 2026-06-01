#!/usr/bin/env node
// Usage: node scripts/make-super-admin.js email@example.com
require("dotenv/config");
const { Client } = require("pg");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-super-admin.js email@example.com");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Make sure .env.local exists.");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query('SELECT id, name, "systemRole" FROM "User" WHERE email = $1', [email]);
  if (res.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    await client.end();
    process.exit(1);
  }

  const user = res.rows[0];
  if (user.systemRole === "SUPER_ADMIN") {
    console.log(`${user.name} (${email}) is already a Super Admin.`);
    await client.end();
    process.exit(0);
  }

  await client.query('UPDATE "User" SET "systemRole" = $1, "updatedAt" = NOW() WHERE email = $2', ["SUPER_ADMIN", email]);
  console.log(`✓ ${user.name} (${email}) has been granted Super Admin.`);
  console.log("They will see the Admin Panel on the dashboard after their next login.");
  await client.end();
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
