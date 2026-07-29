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
// `unsafe-eval` (not just `wasm-unsafe-eval`): confirmed live via
// chrome-devtools-mcp — Cesium's own runtime throws `EvalError: Evaluating
// a string as JavaScript violates CSP` without it. Cesium depends on `jsep`
// (a JS expression parser used internally for its styling-expression
// system) which compiles expressions via `new Function(...)`/`eval` — this
// is a documented, unavoidable Cesium requirement in strict-CSP setups, not
// a bug in this app. `wasm-unsafe-eval` alone (which only covers
// WebAssembly.instantiate with dynamic code) doesn't cover it.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
    // Cesium's ESM build statically references its own .wasm companions
    // (draco/basis/zip decoders under ThirdParty/) as plain runtime-fetched
    // binary assets, not real WASM module imports. Without this, Turbopack
    // defaults to `type: 'wasm'` (native WebAssembly module processing) for
    // any reachable .wasm import, which corrupts large binaries into a
    // malformed JS template literal — confirmed via `node --check` throwing
    // "Octal escape sequences are not allowed in template strings" on the
    // built chunk. `type: 'asset'` just emits the file and returns a URL,
    // matching how Cesium actually wants to consume it (and matching the
    // already-copied public/cesium/ThirdParty/*.wasm files from
    // scripts/copy-cesium-assets.mjs, which is the URL Cesium actually
    // fetches from at runtime via CESIUM_BASE_URL).
    rules: {
      "*.wasm": {
        type: "asset",
      },
    },
  },
  webpack(config, { webpack }) {
    // Cesium ships Build/Cesium/index.js as its OWN already-bundled esbuild
    // output (confirmed valid on its own via `node --check` — the file as
    // shipped by npm is not corrupted). noParse tells webpack to include it
    // as an opaque blob during bundling rather than re-parsing its AST —
    // standard practice for an already-bundled third-party file, and safe
    // here since its own wasm/worker loading goes through runtime string
    // URLs (CESIUM_BASE_URL + fetch), not webpack-resolved imports.
    config.module.noParse = /cesium[\\/]Build[\\/]Cesium[\\/]index\.js$/;

    // The actual bug, isolated by bisecting with `next build --no-mangling`
    // then `optimization.minimize = false`: it's specifically Next's
    // production JS *minifier* (not bundling/parsing) that corrupts a large
    // byte range of certain vendor files into invalid syntax — some
    // binary-adjacent content ends up mis-escaped into a JS template
    // literal, failing `node --check` with "Octal escape sequences are not
    // allowed in template strings" on the *output* chunk (confirmed to
    // disappear entirely with minification off, so it's not bundling/
    // parsing/wasm-handling at fault). Two real trigger files found so far,
    // both @cesium/engine dependencies for Gaussian-splat rendering — a
    // feature this app never uses:
    //   - cesium/Build/Cesium/index.js — already Cesium's own pre-bundled
    //     esbuild output (confirmed valid on its own via `node --check`).
    //   - @spz-loader/core — an Emscripten "SINGLE_FILE" build that embeds
    //     its whole .spz-format WASM decoder as a giant string literal
    //     directly in its JS, the exact shape of content this minifier bug
    //     chokes on.
    // Re-minifying an already-minified third-party bundle wastes work even
    // without the bug, so the fix is to skip minification for whichever
    // chunk(s) contain either of these, not to disable minification
    // project-wide. Next's MinifyPlugin (node_modules/next/dist/build/
    // webpack/plugins/minify-webpack-plugin) skips any asset already
    // flagged `info.minimized`, checked in a processAssets hook staged at
    // PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE — this plugin runs earlier
    // (PROCESS_ASSETS_STAGE_PRE_PROCESS) and pre-flags every chunk
    // containing either file as already-minimized. If a third trigger
    // surfaces later, add its resource-path substring to `TRIGGERS` below
    // rather than assuming these two are exhaustive.
    const TRIGGERS = ["cesium/Build/Cesium/index.js", "@spz-loader/core"];
    config.plugins.push({
      apply(compiler: import("webpack").Compiler) {
        compiler.hooks.thisCompilation.tap("SkipMinifyForWasmEmbeds", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "SkipMinifyForWasmEmbeds",
              stage: webpack.Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
            },
            () => {
              for (const chunk of compilation.chunks) {
                const modules = compilation.chunkGraph.getChunkModulesIterable(chunk);
                const shouldSkip = Array.from(modules).some((mod) => {
                  const resource = (mod as { resource?: string }).resource;
                  return resource && TRIGGERS.some((t) => resource.includes(t));
                });
                if (!shouldSkip) continue;
                for (const file of chunk.files) {
                  const asset = compilation.getAsset(file);
                  if (asset) {
                    compilation.updateAsset(file, asset.source, { ...asset.info, minimized: true });
                  }
                }
              }
            },
          );
        });
      },
    });

    return config;
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
