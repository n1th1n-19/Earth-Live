#!/usr/bin/env node
// Regression guard for the Next.js production-minifier corruption that
// SkipMinifyForWasmEmbeds (next.config.ts) works around.
//
// Next's minifier corrupts the chunks containing `cesium/Build/Cesium/index.js`
// and `@spz-loader/core`, emitting a broken JS template literal that fails to
// parse ("SyntaxError: Octal escape sequences are not allowed in template
// strings"). The app still *builds* clean when this happens — the failure only
// shows up in a browser as a globe permanently stuck on "Loading globe…" —
// so a green build is not evidence the workaround still holds.
//
// This syntax-checks every emitted chunk, and separately asserts the two
// known trigger files are actually present in the bundle (so a silently
// dropped/renamed dependency can't make this check vacuously pass).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const CHUNK_DIR = path.join(process.cwd(), ".next", "static", "chunks");
// Runtime strings that survive minification, unlike the webpack module paths
// SkipMinifyForWasmEmbeds matches on: `CESIUM_BASE_URL` proves Cesium's engine
// bundle is present, `@spz-loader/core` proves the other trigger package is.
const REQUIRED_MARKERS = ["CESIUM_BASE_URL", "@spz-loader/core"];

function collectChunks(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectChunks(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

let chunks;
try {
  chunks = collectChunks(CHUNK_DIR);
} catch {
  console.error(`✗ No chunk directory at ${CHUNK_DIR} — run \`npm run build\` first.`);
  process.exit(1);
}

if (chunks.length === 0) {
  console.error(`✗ No .js chunks found in ${CHUNK_DIR} — the build produced nothing to check.`);
  process.exit(1);
}

const corrupted = [];
for (const chunk of chunks) {
  try {
    execFileSync(process.execPath, ["--check", chunk], { stdio: "pipe" });
  } catch (err) {
    corrupted.push(`${path.relative(process.cwd(), chunk)}\n    ${String(err.stderr).trim().split("\n")[0]}`);
  }
}

// Skipped entirely when a chunk is already corrupt — that failure is
// reported below regardless, so there's no point reading every chunk again.
// Stops early once both markers turn up.
const seen = new Set();
if (corrupted.length === 0) {
  for (const chunk of chunks) {
    if (seen.size === REQUIRED_MARKERS.length) break;
    const content = readFileSync(chunk, "utf8");
    for (const marker of REQUIRED_MARKERS) {
      if (!seen.has(marker) && content.includes(marker)) seen.add(marker);
    }
  }
}
const missing = REQUIRED_MARKERS.filter((m) => !seen.has(m));

if (corrupted.length > 0) {
  console.error(
    `✗ ${corrupted.length} of ${chunks.length} chunks failed \`node --check\` — the minifier ` +
      `workaround in next.config.ts is no longer holding:\n  - ${corrupted.join("\n  - ")}`,
  );
  process.exit(1);
}

if (missing.length > 0) {
  console.error(
    `✗ Expected marker(s) absent from the bundle: ${missing.join(", ")}. Either the dependency ` +
      `moved or SkipMinifyForWasmEmbeds is now targeting the wrong files — re-verify next.config.ts ` +
      `rather than deleting this check.`,
  );
  process.exit(1);
}

console.log(`✓ ${chunks.length} chunks parsed cleanly; both minifier-workaround markers present.`);
