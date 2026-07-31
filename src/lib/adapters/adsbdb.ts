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
  // `:v2:` because the cached value shape changed (bare FlightRoute → the
  // `{ route }` wrapper below). Without the version bump, entries written by
  // the previous deploy stay readable for the full 24h TTL and deserialize
  // into `{ route: undefined }`, which surfaced as a 502.
  const cacheKey = `adsbdb:route:v2:${trimmed}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    // Wrapped in an object because cacheGet treats a bare `null` as a miss —
    // an unresolvable callsign (the common case for general aviation) would
    // otherwise re-hit adsbdb on every single selection, never caching.
    const { value, cacheHit } = await cacheAside<{ route: FlightRoute | null }>(
      cacheKey,
      CACHE_TTL_SECONDS,
      async () => {
        const response = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(trimmed)}`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(5000),
        });
        statusCode = response.status;
        // 404 with {"response":"unknown callsign"} is a real, expected outcome
        // for general aviation / unlisted callsigns — not an error to throw on.
        if (response.status === 404) return { route: null };
        if (!response.ok) throw new Error(`adsbdb request failed with status ${response.status}`);

        const json = await response.json();
        const parsed = responseSchema.parse(json);
        if (typeof parsed.response === "string") return { route: null };

        const { origin, destination } = parsed.response.flightroute;
        return {
          route: {
            origin: { name: origin.name, latitude: origin.latitude, longitude: origin.longitude },
            destination: { name: destination.name, latitude: destination.latitude, longitude: destination.longitude },
          },
        };
      },
    );

    logApiCall({
      source: "adsbdb",
      endpoint: "/v0/callsign",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    // `?? null` so an unexpected cached shape degrades to "no route known"
    // rather than an undefined body the route handler can't serialize.
    return value?.route ?? null;
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
