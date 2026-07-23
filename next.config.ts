import path from "node:path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
