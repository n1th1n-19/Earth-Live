import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import type { NextConfig } from "next";

// docs/10-security-guide.md §10.3. The globe is a wireframe look (black
// globe, country borders + graticule as lines, no imagery/terrain provider)
// — no external tile host is fetched at all. Country borders are a bundled
// static file (public/data/ne_110m_admin_0_countries.geojson, same-origin,
// already covered by 'self'); marker icons are `data:` URIs (already
// covered below). This used to list Bing/OSM/GIBS/Cesium-ion hosts for the
// photoreal imagery/terrain/clouds/night-lights that were removed in favor
// of the wireframe globe — nothing external to allowlist anymore.
//
// `unsafe-inline` on script-src (this was the actual root cause of the
// long-running stuck "Loading globe…" bug, traced with real browser tooling
// — not Cesium, not CESIUM_BASE_URL, not any of the fixes chased earlier):
// Next.js App Router streams RSC payloads to the client via inline
// `<script>self.__next_f.push(...)</script>` tags. Without 'unsafe-inline'
// (or a nonce), the CSP silently blocked every one of them — confirmed live
// via chrome-devtools-mcp: 6 "Executing inline script violates CSP
// script-src" console errors that looked like browser-extension noise but
// weren't, plus React's own RSC stream reader throwing "Connection closed"
// because it never received its expected chunks. That starved every
// ssr:false dynamic import (Globe included) permanently, while
// synchronously-rendered shell content (buttons, panels) still appeared —
// exactly the "everything but the globe works" symptom. Per Next's own
// bundled docs (node_modules/next/dist/docs/01-app/02-guides/content-
// security-policy.md), the alternative is a per-request nonce, which
// requires converting every page to dynamic rendering (loses static
// optimization/CDN caching everywhere) — not worth it for an app with no
// auth, no PII, and no user-generated content rendered back to other users.
// `unsafe-eval`/`wasm-unsafe-eval` are gone from script-src as of the
// Cesium removal — they existed solely for Cesium's `jsep` expression
// parser and its WASM decoders (draco/basis), both gone with the globe
// rewrite to a 2D canvas/d3 renderer.
//
// FOLLOW-UP (tracked in docs/10-security-guide.md §10.3): `unsafe-inline`
// above is an accepted relaxation, not a permanent choice — re-tighten once
// Next.js supports nonce-based RSC streaming without forcing every route
// dynamic.
//
// Third-party origins are limited to Cloudflare Web Analytics
// (src/components/Analytics.tsx): `static.cloudflareinsights.com` serves the
// beacon script and `cloudflareinsights.com` receives the measurements via
// navigator.sendBeacon. Both entries are inert unless
// NEXT_PUBLIC_CF_BEACON_TOKEN is configured, since nothing loads the beacon
// otherwise — but the CSP must list them or the browser blocks it silently.
//
// Error reporting needs no entry here: `tunnelRoute` below routes it through
// this app's own /monitoring path, same-origin.
//
// Place summaries and climate normals are fetched server-side through this
// app's own /api/place-info route, so they need no client-side entry either.
// Who may embed this app in an <iframe>. Deliberately an allowlist, not `*`:
// anyone not named here gets the browser's "won't display" refusal.
//
// The wildcard covers www. and any other MeWe subdomain that might serve the
// embedding page; `https://mewe.com` has to be listed separately because a
// wildcard does not match the bare apex domain.
//
// Override per-environment with FRAME_ANCESTORS as a space- or
// comma-separated origin list. Origins must be scheme-qualified and carry no
// path — browsers silently ignore a malformed frame-ancestors source rather
// than reporting it, which looks identical to the embed just not working.
const DEFAULT_FRAME_ANCESTORS = ["https://mewe.com", "https://*.mewe.com"];

const configuredFrameAncestors = (process.env.FRAME_ANCESTORS ?? "")
  .split(/[\s,]+/)
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const frameAncestors =
  configuredFrameAncestors.length > 0 ? configuredFrameAncestors : DEFAULT_FRAME_ANCESTORS;

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  frameAncestors.length > 0
    ? `frame-ancestors ${frameAncestors.join(" ")}`
    : "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Was off for Resium's WebGL Viewer (StrictMode's dev-only double-invoke
  // corrupted its GL context). Resium/Cesium are gone; left off here since
  // re-enabling is an app-wide behavior change outside this cleanup's scope.
  reactStrictMode: false,
  async headers() {
    // Production only: Next dev's Turbopack HMR/chunk-loading runtime uses
    // eval()-based module wrapping for source-mapped stack traces, which
    // `script-src`'s lack of 'unsafe-eval' silently blocked — this is what
    // was actually behind the stuck "Loading globe…" and the earlier HMR
    // "Invariant: Expected a request ID" error, not a Cesium/app bug. CSP
    // is a production hardening concern; dev tooling needs looser script
    // execution than any real deployment should ever allow.
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // No X-Frame-Options. It predates CSP and only understands
          // DENY/SAMEORIGIN — it cannot express a cross-origin allowlist, and
          // browsers that support both give it precedence, so leaving
          // `DENY` here would keep blocking the allowed embedders above.
          // `frame-ancestors` in the CSP is the modern equivalent and is
          // honoured by every browser this app targets.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

// The @sentry/nextjs SDK is kept, but it reports to GlitchTip (see
// sentry.*.config.ts) — so every sentry.io-specific build step is switched
// off here:
//
//  - Source-map upload. GlitchTip *does* accept uploads (point the plugin at
//    it with `sentryUrl` + `org`/`project` and a GlitchTip auth token, or use
//    glitchtip-cli), so this is off by choice, not incapability: it needs an
//    auth token and org/project slugs that aren't configured here. Stack
//    traces stay readable because Next emits source maps the browser resolves
//    locally. To turn it on, set the token and add
//    `sentryUrl: "https://app.glitchtip.com"` alongside org/project below.
//  - `automaticVercelMonitors` instruments Sentry Crons, another product
//    GlitchTip doesn't ingest.
//
// `tunnelRoute` is kept: it proxies error reports through this app's own
// /monitoring path, which both dodges ad-blockers and keeps the reporting
// endpoint same-origin so the CSP needs no entry for it.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,

  sourcemaps: {
    disable: true,
  },

  tunnelRoute: "/monitoring",

  webpack: {
    automaticVercelMonitors: false,

    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
