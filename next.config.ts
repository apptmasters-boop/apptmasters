import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    // The production server (1 GB RAM) runs out of memory during the type-check
    // step of `next build`. Type-checking happens before deploy instead
    // (`npm run typecheck`, also in CI), so the server build sets
    // SKIP_BUILD_TYPECHECK=1. Every other build still type-checks.
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1",
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
});
