import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * API tests call the route handlers in src/app/api directly against a real
 * Postgres database (TEST_DATABASE_URL), so they exercise the same Prisma
 * queries and permission checks as production. See tests/README.md.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // One database is shared by every test file, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
