/**
 * Resolves the database the tests run against.
 *
 * Safety: the suite writes throwaway users, apartments and listings into this
 * database, so we refuse to start unless its name clearly marks it as a test
 * database. This keeps a mistyped URL from ever pointing the suite at real data.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5433/apptmasters_test";

export function assertIsTestDatabase(url: string) {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": its name must contain "test" because the suite resets it.`,
    );
  }
}
