import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import type { NextConfig } from "next";

// docs/10-security-guide.md §10.3. `tile.openstreetmap.org` is allowlisted
// because the globe currently fetches OSM tiles client-side directly (not
// proxied) — see the note in docs/05-api-integration-guide.md §5.5 about
// moving to a self-hosted tile pipeline before production traffic, at
// which point this can tighten to 'self'. `unsafe-inline` on style-src is
// needed for Cesium's own widget/credit-container styles, which it injects
// inline. No CORS headers are added anywhere: Route Handlers default to
// same-origin-only unless explicitly opened up, which is the locked-down
// state docs/10-security-guide.md §10.6 asks for — there's nothing to add.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://tile.openstreetmap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // React Strict Mode's dev-only double-invoke (mount -> cleanup -> mount)
  // is fine for idempotent effects, but Resium's Viewer creates a real
  // WebGL context imperatively on mount; the synthetic destroy+recreate
  // cycle leaves stale GL resources bound to the first (destroyed) context,
  // spamming "bindTexture: object does not belong to this context" and is
  // never actually exercised in production (StrictMode is dev-only). This
  // is the standard, accepted trade-off for Cesium/React integrations.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "earth-live",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
