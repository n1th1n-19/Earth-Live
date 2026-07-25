import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// OpenAQ — docs/05-api-integration-guide.md §5.2. Requires a free
// OPENAQ_API_KEY (explore.openaq.org). Live-verified against the real v3
// API: nearest station + sensor list from `/v3/locations`, then actual
// pollutant readings from `/v3/locations/{id}/latest`, joined on sensorsId
// (the locations endpoint alone only returns station metadata, not values).
const CACHE_TTL_SECONDS = 30 * 60;

const locationsResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
      distance: z.number().optional(),
      sensors: z.array(
        z.object({
          id: z.number(),
          parameter: z.object({
            name: z.string(),
            units: z.string(),
            displayName: z.string(),
          }),
        }),
      ),
    }),
  ),
});

const latestResponseSchema = z.object({
  results: z.array(
    z.object({
      sensorsId: z.number(),
      value: z.number(),
      datetime: z.object({ utc: z.string() }),
    }),
  ),
});

export interface NearbyStation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface Measurement {
  parameter: string;
  displayName: string;
  value: number;
  units: string;
  measuredAt: string;
}

export interface AirQuality {
  stationId: number;
  stationName: string;
  distanceMeters: number | null;
  measurements: Measurement[];
}

function apiKeyOrThrow(): string {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) throw new Error("OPENAQ_API_KEY is not configured — see .env.example");
  return apiKey;
}

export async function fetchNearbyStations(latitude: number, longitude: number): Promise<NearbyStation[]> {
  const apiKey = apiKeyOrThrow();
  const cacheKey = `openaq:locations:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = new URL("https://api.openaq.org/v3/locations");
      url.searchParams.set("coordinates", `${latitude},${longitude}`);
      url.searchParams.set("radius", "25000");
      url.searchParams.set("limit", "5");

      const response = await fetch(url, { headers: { "X-API-Key": apiKey }, next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`OpenAQ request failed with status ${response.status}`);

      const parsed = locationsResponseSchema.parse(await response.json());
      return parsed.results.map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.coordinates.latitude,
        longitude: r.coordinates.longitude,
      }));
    });

    logApiCall({ source: "openaq", endpoint: "/v3/locations", statusCode, latencyMs: Date.now() - started, cacheHit });
    return value;
  } catch (err) {
    logApiCall({
      source: "openaq",
      endpoint: "/v3/locations",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function fetchNearestAirQuality(latitude: number, longitude: number): Promise<AirQuality | null> {
  const apiKey = apiKeyOrThrow();
  const cacheKey = `openaq:aqi:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const locationsUrl = new URL("https://api.openaq.org/v3/locations");
      locationsUrl.searchParams.set("coordinates", `${latitude},${longitude}`);
      locationsUrl.searchParams.set("radius", "25000");
      locationsUrl.searchParams.set("limit", "1");

      const locationsRes = await fetch(locationsUrl, { headers: { "X-API-Key": apiKey }, next: { revalidate: 0 } });
      statusCode = locationsRes.status;
      if (!locationsRes.ok) throw new Error(`OpenAQ locations request failed with status ${locationsRes.status}`);

      const locationsParsed = locationsResponseSchema.parse(await locationsRes.json());
      const nearest = locationsParsed.results[0];
      if (!nearest) return null;

      const sensorMeta = new Map(nearest.sensors.map((s) => [s.id, s.parameter]));

      const latestUrl = `https://api.openaq.org/v3/locations/${nearest.id}/latest`;
      const latestRes = await fetch(latestUrl, { headers: { "X-API-Key": apiKey }, next: { revalidate: 0 } });
      statusCode = latestRes.status;
      if (!latestRes.ok) throw new Error(`OpenAQ latest request failed with status ${latestRes.status}`);

      const latestParsed = latestResponseSchema.parse(await latestRes.json());
      const measurements: Measurement[] = latestParsed.results
        .map((r) => {
          const meta = sensorMeta.get(r.sensorsId);
          if (!meta) return null;
          return {
            parameter: meta.name,
            displayName: meta.displayName,
            value: r.value,
            units: meta.units,
            measuredAt: r.datetime.utc,
          };
        })
        .filter((m): m is Measurement => m !== null);

      return {
        stationId: nearest.id,
        stationName: nearest.name,
        distanceMeters: nearest.distance ?? null,
        measurements,
      };
    });

    logApiCall({
      source: "openaq",
      endpoint: "/v3/locations/{id}/latest",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });
    return value;
  } catch (err) {
    logApiCall({
      source: "openaq",
      endpoint: "/v3/locations/{id}/latest",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
