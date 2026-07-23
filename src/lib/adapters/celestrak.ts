import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// CelesTrak TLE catalog — docs/05-api-integration-guide.md §5.4.
// No key. TLEs only change 1-2x/day upstream; CelesTrak asks for infrequent
// polling, so this is cached for 6 hours server-side. Live motion is computed
// client-side via SGP4 (satellite.js) from these cached elements — see
// src/lib/satellite-propagation.ts — not by re-polling CelesTrak.
//
// Uses FORMAT=tle (plain 3-line-per-object text), not FORMAT=json: CelesTrak's
// JSON output is OMM (Orbit Mean-Elements Message) — mean-motion/eccentricity/
// inclination fields, not literal TLE_LINE1/TLE_LINE2 strings — so the classic
// two-line-element format is actually the more direct source for
// `satellite.twoline2satrec`, which is what src/lib/satellite-propagation.ts
// needs.
const CACHE_TTL_SECONDS = 6 * 60 * 60;

export interface SatelliteElement {
  name: string;
  noradId: number;
  tleLine1: string;
  tleLine2: string;
}

export type CelesTrakGroup = "stations" | "active" | "weather" | "starlink";

export async function fetchSatelliteGroup(group: CelesTrakGroup): Promise<SatelliteElement[]> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(`celestrak:${group}`, CACHE_TTL_SECONDS, async () => {
      const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`;
      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`CelesTrak request failed with status ${response.status}`);

      const text = await response.text();
      return parseTle(text);
    });

    logApiCall({
      source: "celestrak",
      endpoint: `/NORAD/elements/gp.php?GROUP=${group}`,
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "celestrak",
      endpoint: `/NORAD/elements/gp.php?GROUP=${group}`,
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function parseTle(text: string): SatelliteElement[] {
  const lines = text.split("\n").map((l) => l.trimEnd());
  const satellites: SatelliteElement[] = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i]?.trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!name || !line1?.startsWith("1 ") || !line2?.startsWith("2 ")) continue;

    const noradId = Number.parseInt(line1.slice(2, 7), 10);
    satellites.push({ name, noradId, tleLine1: line1, tleLine2: line2 });
  }

  return satellites;
}
