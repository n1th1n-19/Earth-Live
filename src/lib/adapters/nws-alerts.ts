import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// US National Weather Service active alerts — free, keyless, verified live.
// api.weather.gov requires a User-Agent identifying the application; they
// treat requests without one as abuse.
//
// Only Extreme and Severe alerts are requested. NWS also publishes Moderate
// and Minor, which together are the large majority and would swamp the map
// with routine advisories.
//
// IMPORTANT COVERAGE LIMIT: most active alerts carry `geometry: null` and
// describe their area by zone reference instead (measured live: 51 of 62).
// Resolving those would mean a separate boundary request per zone. This
// adapter therefore returns only alerts that ship real polygons, and the
// layer says so rather than implying it shows every warning in effect.
const CACHE_TTL_SECONDS = 5 * 60;
const UPSTREAM_TIMEOUT_MS = 15_000;
const USER_AGENT = process.env.NWS_USER_AGENT || "EarthLive/1.0 (github.com/n1th1n-19/Earth-Live)";

const featureSchema = z.object({
  geometry: z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.unknown()),
  }),
  properties: z.object({
    id: z.string().optional(),
    event: z.string(),
    severity: z.string(),
    headline: z.string().nullable().optional(),
    areaDesc: z.string().nullable().optional(),
    senderName: z.string().nullable().optional(),
    effective: z.string().nullable().optional(),
    expires: z.string().nullable().optional(),
  }),
});

const responseSchema = z.object({ features: z.array(z.unknown()) });

export type AlertSeverity = "Extreme" | "Severe";

export interface WeatherAlert {
  id: string;
  event: string;
  severity: AlertSeverity;
  headline: string | null;
  areaDesc: string | null;
  senderName: string | null;
  expires: string | null;
  /**
   * Outer rings as flat [lon, lat, lon, lat, …], ready for
   * Cesium's Cartesian3.fromDegreesArray. A MultiPolygon contributes one
   * entry per part, so a single alert can produce several rings.
   */
  rings: number[][];
  /** Rough centroid of the first ring, for labelling and fly-to. */
  latitude: number;
  longitude: number;
}

/** Pulls outer rings out of a GeoJSON Polygon/MultiPolygon coordinate array. */
function extractRings(type: "Polygon" | "MultiPolygon", coordinates: unknown): number[][] {
  const positionPairs = z.array(z.tuple([z.number(), z.number()]).rest(z.number()));
  // A Polygon's first element is its outer ring; holes are ignored, since
  // these are warning areas rather than precise cartography.
  const polygons = type === "Polygon" ? [coordinates] : (coordinates as unknown[]);

  const rings: number[][] = [];
  for (const polygon of polygons) {
    const outer = Array.isArray(polygon) ? polygon[0] : null;
    const parsed = positionPairs.safeParse(outer);
    if (!parsed.success || parsed.data.length < 3) continue;
    rings.push(parsed.data.flatMap(([lon, lat]) => [lon, lat]));
  }
  return rings;
}

export async function fetchWeatherAlerts(): Promise<WeatherAlert[]> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(
      "nws:alerts:extreme-severe",
      CACHE_TTL_SECONDS,
      async () => {
        const url =
          "https://api.weather.gov/alerts/active?severity=Extreme,Severe&status=actual";
        const response = await fetch(url, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          headers: { "User-Agent": USER_AGENT, accept: "application/geo+json" },
        });
        statusCode = response.status;
        if (!response.ok) throw new Error(`NWS request failed with status ${response.status}`);

        const parsed = responseSchema.parse(await response.json());

        return parsed.features
          .map((raw, index): WeatherAlert | null => {
            // Per-feature parsing: the common case is `geometry: null`, which
            // simply fails this schema and is skipped, and a single odd
            // record can't blank the layer.
            const result = featureSchema.safeParse(raw);
            if (!result.success) return null;

            const { geometry, properties: p } = result.data;
            const rings = extractRings(geometry.type, geometry.coordinates);
            if (rings.length === 0) return null;

            const first = rings[0];
            let lonSum = 0;
            let latSum = 0;
            for (let i = 0; i < first.length; i += 2) {
              lonSum += first[i];
              latSum += first[i + 1];
            }
            const points = first.length / 2;

            return {
              id: p.id ?? `nws-${index}`,
              event: p.event,
              severity: p.severity === "Extreme" ? "Extreme" : "Severe",
              headline: p.headline?.trim() || null,
              areaDesc: p.areaDesc?.trim() || null,
              senderName: p.senderName?.trim() || null,
              expires: p.expires ?? null,
              rings,
              longitude: lonSum / points,
              latitude: latSum / points,
            };
          })
          .filter((a): a is WeatherAlert => a !== null);
      },
    );

    logApiCall({
      source: "nws",
      endpoint: "/alerts/active",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "nws",
      endpoint: "/alerts/active",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
