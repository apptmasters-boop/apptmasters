import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// Translations (T1, 2026-10-23): src/i18n/request.ts picks the language for each request.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The round "N" button Next.js shows on the local development copy covered
  // the footer during the owner's local tests (2026-10-17). Errors still show.
  devIndicators: false,
  typescript: {
    // The production server (1 GB RAM) runs out of memory during the type-check
    // step of `next build`. Type-checking happens before deploy instead
    // (`npm run typecheck`, also in CI), so the server build sets
    // SKIP_BUILD_TYPECHECK=1. Every other build still type-checks.
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1",
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
});
