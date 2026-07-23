// Copies Cesium's static runtime assets (Workers, Assets, ThirdParty, Widgets)
// into public/cesium so the browser can load them from a plain static path
// (window.CESIUM_BASE_URL) without bundler-specific asset plugins.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

if (!existsSync(source)) {
  console.warn(`[copy-cesium-assets] source not found: ${source} (skipping)`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

for (const folder of ["Workers", "Assets", "ThirdParty", "Widgets"]) {
  const from = join(source, folder);
  if (!existsSync(from)) continue;
  cpSync(from, join(dest, folder), { recursive: true });
}

console.log(`[copy-cesium-assets] copied Cesium static assets to ${dest}`);
