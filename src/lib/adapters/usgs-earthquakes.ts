import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// USGS Earthquake Hazards Program — docs/05-api-integration-guide.md §5.3.
// No key. Public domain. Cache TTL 60s (matches the feed's own update cadence).
const CACHE_TTL_SECONDS = 60;
const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

const featureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    url: z.string(),
    tsunami: z.number(),
    sig: z.number(),
  }),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number(), z.number()]),
  }),
});

const feedSchema = z.object({
  features: z.array(featureSchema),
});

export interface Earthquake {
  id: string;
  magnitude: number | null;
  place: string | null;
  occurredAt: string;
  url: string;
  tsunami: boolean;
  significance: number;
  latitude: number;
  longitude: number;
  depthKm: number;
}

export async function fetchRecentEarthquakes(): Promise<Earthquake[]> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside("usgs:earthquakes:day", CACHE_TTL_SECONDS, async () => {
      const response = await fetch(FEED_URL, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`USGS feed failed with status ${response.status}`);

      const json = await response.json();
      const parsed = feedSchema.parse(json);
      return parsed.features.map(normalize);
    });

    logApiCall({
      source: "usgs_earthquakes",
      endpoint: "/earthquakes/feed/v1.0/summary/all_day.geojson",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "usgs_earthquakes",
      endpoint: "/earthquakes/feed/v1.0/summary/all_day.geojson",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function normalize(feature: z.infer<typeof featureSchema>): Earthquake {
  const [longitude, latitude, depthKm] = feature.geometry.coordinates;
  return {
    id: feature.id,
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    occurredAt: new Date(feature.properties.time).toISOString(),
    url: feature.properties.url,
    tsunami: feature.properties.tsunami === 1,
    significance: feature.properties.sig,
    latitude,
    longitude,
    depthKm,
  };
}
