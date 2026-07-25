import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// NASA FIRMS (wildfires) — docs/05-api-integration-guide.md §5.3.
// UNTESTED: requires a free FIRMS_MAP_KEY (firms.modaps.eosdis.nasa.gov/api/map_key)
// which is not configured in this environment. Code follows the documented
// CSV response shape exactly; verify against a real key before enabling the
// wildfires layer in the UI.
const CACHE_TTL_SECONDS = 3 * 60 * 60; // matches satellite revisit cadence, §5.12
const AREA = "world"; // FIRMS area/csv endpoint accepts a bounding box or "world"
const DAY_RANGE = 1;
// Global VIIRS 24h detections run 30k-100k+ rows (confirmed live: 66,608 on
// 2026-07-25) — WildfireLayer renders one Resium <Entity> per row, and
// mounting that many in one commit is what was crashing the browser tab.
// Same cap pattern as MAX_FLIGHTS in opensky.ts; kept highest brightness_ti4
// first since that's the strongest signal of an actual active fire.
const MAX_FIRES = 1000;

export interface FireDetection {
  latitude: number;
  longitude: number;
  brightness: number;
  confidence: string;
  satellite: string;
  acquiredAt: string;
}

export async function fetchActiveFires(): Promise<FireDetection[]> {
  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    throw new Error("FIRMS_MAP_KEY is not configured — see .env.example");
  }

  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside("firms:active-fires:world", CACHE_TTL_SECONDS, async () => {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/${AREA}/${DAY_RANGE}`;
      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`FIRMS request failed with status ${response.status}`);

      const csv = await response.text();
      return parseCsv(csv);
    });

    logApiCall({
      source: "nasa_firms",
      endpoint: "/api/area/csv/VIIRS_SNPP_NRT",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "nasa_firms",
      endpoint: "/api/area/csv/VIIRS_SNPP_NRT",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// FIRMS CSV columns: latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,
// satellite,instrument,confidence,version,bright_ti5,frp,daynight
function parseCsv(csv: string): FireDetection[] {
  const [header, ...lines] = csv.trim().split("\n");
  const columns = header.split(",");
  const latIdx = columns.indexOf("latitude");
  const lonIdx = columns.indexOf("longitude");
  const brightIdx = columns.indexOf("bright_ti4");
  const confIdx = columns.indexOf("confidence");
  const satIdx = columns.indexOf("satellite");
  const dateIdx = columns.indexOf("acq_date");
  const timeIdx = columns.indexOf("acq_time");

  return lines
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",");
      return {
        latitude: Number.parseFloat(cells[latIdx]),
        longitude: Number.parseFloat(cells[lonIdx]),
        brightness: Number.parseFloat(cells[brightIdx]),
        confidence: cells[confIdx],
        satellite: cells[satIdx],
        acquiredAt: `${cells[dateIdx]}T${cells[timeIdx].padStart(4, "0").slice(0, 2)}:${cells[timeIdx].padStart(4, "0").slice(2)}:00Z`,
      };
    })
    .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, MAX_FIRES);
}
