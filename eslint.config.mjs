import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The screenshot tool's own browser profile and downloads (not in git).
    "scripts/dev/screenshots/profile/**",
    "scripts/dev/screenshots/node_modules/**",
    "scripts/dev/screenshots/out*/**",
  ]),
]);

export default eslintConfig;
