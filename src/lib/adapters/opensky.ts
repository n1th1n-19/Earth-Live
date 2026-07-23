import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// OpenSky Network — docs/05-api-integration-guide.md §5.6.
// Anonymous access only (no OPENSKY_CLIENT_ID/SECRET configured here) — the
// anonymous quota (~400 credits/day) is far tighter than a registered
// account's (~4000/day), so this uses a more conservative 45s cache TTL than
// the 10s documented for a registered account. Tighten once OpenSky OAuth
// credentials are provisioned (docs/05-api-integration-guide.md §5.6).
const CACHE_TTL_SECONDS = 45;
const MAX_FLIGHTS = 400; // keeps the globe renderable until marker clustering (Phase 5) ships

// OpenSky's state vector is a positional array, not an object — index meanings
// per https://opensky-network.org/apidoc/rest.html#all-state-vectors.
const stateVectorSchema = z.tuple([
  z.string(), // 0 icao24
  z.string().nullable(), // 1 callsign
  z.string().nullable(), // 2 origin_country
  z.number().nullable(), // 3 time_position
  z.number().nullable(), // 4 last_contact
  z.number().nullable(), // 5 longitude
  z.number().nullable(), // 6 latitude
  z.number().nullable(), // 7 baro_altitude
  z.boolean(), // 8 on_ground
  z.number().nullable(), // 9 velocity
  z.number().nullable(), // 10 true_track
  z.number().nullable(), // 11 vertical_rate
  z.array(z.number()).nullable(), // 12 sensors
  z.number().nullable(), // 13 geo_altitude
  z.string().nullable(), // 14 squawk
  z.boolean(), // 15 spi
  z.number(), // 16 position_source
]);

const responseSchema = z.object({
  time: z.number(),
  states: z.array(stateVectorSchema).nullable(),
});

export interface Flight {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  velocityMs: number | null;
  headingDeg: number | null;
  onGround: boolean;
}

export async function fetchFlights(): Promise<Flight[]> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside("opensky:states:all", CACHE_TTL_SECONDS, async () => {
      const response = await fetch("https://opensky-network.org/api/states/all", {
        next: { revalidate: 0 },
      });
      statusCode = response.status;
      if (!response.ok) throw new Error(`OpenSky request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = responseSchema.parse(json);
      return (parsed.states ?? [])
        .filter((s) => s[5] != null && s[6] != null && !s[8])
        .slice(0, MAX_FLIGHTS)
        .map(normalize);
    });

    logApiCall({
      source: "opensky",
      endpoint: "/api/states/all",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "opensky",
      endpoint: "/api/states/all",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function normalize(state: z.infer<typeof stateVectorSchema>): Flight {
  return {
    icao24: state[0],
    callsign: state[1]?.trim() || null,
    originCountry: state[2] ?? "Unknown",
    longitude: state[5]!,
    latitude: state[6]!,
    altitudeM: state[7],
    velocityMs: state[9],
    headingDeg: state[10],
    onGround: state[8],
  };
}
