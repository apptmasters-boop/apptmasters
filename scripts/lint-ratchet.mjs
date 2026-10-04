/**
 * Lint "ratchet": fails if the number of ESLint errors goes UP compared to the
 * recorded baseline, and lowers the baseline automatically when it goes DOWN.
 *
 * Why: the codebase had 75 existing lint errors when CI was introduced
 * (2026-10-03). Fixing them all at once is risky, but new code must not add
 * more. Each cleanup lowers the number until it reaches 0, at which point CI
 * can switch to a plain `eslint` run.
 *
 * Usage: node scripts/lint-ratchet.mjs   (CI runs it via `npm run lint:ratchet`)
 */
import { ESLint } from "eslint";
import { readFileSync, writeFileSync } from "node:fs";

const BASELINE_FILE = new URL("../.lint-baseline.json", import.meta.url);
const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));

const results = await new ESLint().lintFiles(["."]);
const errors = results.reduce((n, r) => n + r.errorCount, 0);

if (errors > baseline.errors) {
  const formatter = await new ESLint().loadFormatter("stylish");
  console.log(await formatter.format(results.filter(r => r.errorCount > 0)));
  console.error(`\nLint errors went up: ${errors} (baseline ${baseline.errors}). Fix the new errors above.`);
  process.exit(1);
}

if (errors < baseline.errors) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ errors }, null, 2) + "\n");
  console.log(`Lint errors went down: ${baseline.errors} -> ${errors}. Baseline updated; commit .lint-baseline.json.`);
} else {
  console.log(`Lint errors: ${errors} (baseline ${baseline.errors}). OK.`);
}
