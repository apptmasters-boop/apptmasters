import { execSync } from "node:child_process";
import { TEST_DATABASE_URL, assertIsTestDatabase } from "./test-db";

/**
 * Runs once before the whole suite: brings the test database's tables in line
 * with prisma/schema.prisma.
 *
 * Deliberately non-destructive (no --force-reset): tests never rely on an
 * empty database. Each test creates its own uniquely named users/apartments/
 * listings and only asserts on those, so leftovers from earlier runs are harmless.
 */
export default function setup() {
  assertIsTestDatabase(TEST_DATABASE_URL);
  execSync("npx prisma db push", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
