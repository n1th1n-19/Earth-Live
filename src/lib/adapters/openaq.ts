import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// OpenAQ — docs/05-api-integration-guide.md §5.2.
// UNTESTED: requires a free OPENAQ_API_KEY (explore.openaq.org) which is not
// configured in this environment. Code follows the documented v3 response
// shape; verify against a real key before enabling in the UI. Open-Meteo's
// keyless Air Quality API (already implemented as a pattern in
// src/lib/adapters/open-meteo.ts) is the primary fallback when no nearby
// OpenAQ station exists, per the docs' own fallback design.
const CACHE_TTL_SECONDS = 30 * 60;

const locationsResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
    }),
  ),
});

export interface NearbyStation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export async function fetchNearbyStations(latitude: number, longitude: number): Promise<NearbyStation[]> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAQ_API_KEY is not configured — see .env.example");
  }

  const cacheKey = `openaq:locations:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = new URL("https://api.openaq.org/v3/locations");
      url.searchParams.set("coordinates", `${latitude},${longitude}`);
      url.searchParams.set("radius", "25000");
      url.searchParams.set("limit", "5");

      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
        next: { revalidate: 0 },
      });
      statusCode = response.status;
      if (!response.ok) throw new Error(`OpenAQ request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = locationsResponseSchema.parse(json);
      return parsed.results.map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.coordinates.latitude,
        longitude: r.coordinates.longitude,
      }));
    });

    logApiCall({
      source: "openaq",
      endpoint: "/v3/locations",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

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
