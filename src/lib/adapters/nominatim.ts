import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// Nominatim — docs/05-api-integration-guide.md §5.5. No key, but requires a
// descriptive User-Agent and respect for the public instance's 1 req/s cap;
// proxied + cached here (24h TTL — place-to-coordinate mappings are static)
// and rate-limited at the route level (src/lib/rate-limit.ts) rather than
// trusted client-side.
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "EarthLive/1.0 (dev)";

const resultSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
    type: z.string(),
    class: z.string(),
    importance: z.number().optional(),
  }),
);

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  type: string;
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `nominatim:search:${trimmed.toLowerCase()}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", trimmed);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "6");

      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 0 },
      });
      statusCode = response.status;
      if (!response.ok) throw new Error(`Nominatim request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = resultSchema.parse(json);
      return parsed.map((r) => ({
        label: r.display_name,
        latitude: Number.parseFloat(r.lat),
        longitude: Number.parseFloat(r.lon),
        type: r.type || r.class,
      }));
    });

    logApiCall({
      source: "nominatim",
      endpoint: "/search",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "nominatim",
      endpoint: "/search",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
