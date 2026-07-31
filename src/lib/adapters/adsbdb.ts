import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// adsbdb.com — free, keyless callsign → route lookup, confirmed live:
// `curl https://api.adsbdb.com/v0/callsign/BAW123` returns real
// origin/destination airport data including lat/lon directly (no need to
// cross-reference a separate airport-coordinates dataset). Route info is
// static (an airline's scheduled routing for a callsign doesn't change
// minute to minute), so cached generously.
const CACHE_TTL_SECONDS = 24 * 60 * 60;

const airportSchema = z.object({
  name: z.string(),
  icao_code: z.string(),
  iata_code: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

const responseSchema = z.object({
  response: z.union([
    z.object({
      flightroute: z.object({
        callsign: z.string(),
        origin: airportSchema,
        destination: airportSchema,
      }),
    }),
    z.string(), // e.g. "unknown callsign"
  ]),
});

export interface FlightRoute {
  origin: { name: string; latitude: number; longitude: number };
  destination: { name: string; latitude: number; longitude: number };
}

export async function fetchFlightRoute(callsign: string): Promise<FlightRoute | null> {
  const trimmed = callsign.trim().toUpperCase();
  const cacheKey = `adsbdb:route:${trimmed}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const response = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(trimmed)}`, {
        next: { revalidate: 0 },
      });
      statusCode = response.status;
      // 404 with {"response":"unknown callsign"} is a real, expected outcome
      // for general aviation / unlisted callsigns — not an error to throw on.
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`adsbdb request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = responseSchema.parse(json);
      if (typeof parsed.response === "string") return null;

      const { origin, destination } = parsed.response.flightroute;
      return {
        origin: { name: origin.name, latitude: origin.latitude, longitude: origin.longitude },
        destination: { name: destination.name, latitude: destination.latitude, longitude: destination.longitude },
      };
    });

    logApiCall({
      source: "adsbdb",
      endpoint: "/v0/callsign",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "adsbdb",
      endpoint: "/v0/callsign",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
