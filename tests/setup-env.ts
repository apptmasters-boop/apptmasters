import { vi } from "vitest";
import { TEST_DATABASE_URL, assertIsTestDatabase } from "./test-db";

// Runs before each test file is imported, so src/lib/db.ts and src/lib/auth.ts
// pick up these values instead of anything in .env.local.
assertIsTestDatabase(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = "test-only-jwt-secret";
// Makes email count as configured, so 2FA is exercised (sending is mocked below).
process.env.RESEND_API_KEY = "re_test_key";

// Tests must never send real email: replace the Resend client with a no-op.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: "test" }, error: null }) };
  },
}));
