import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// OpenSky Network — docs/05-api-integration-guide.md §5.6.
// Registered OAuth2 client (~4000 credits/day) when OPENSKY_CLIENT_ID/SECRET
// are set, falling back to the anonymous ~400/day tier otherwise — verified
// live 2026-07-25: an authenticated request returned
// x-rate-limit-remaining: 3996, where the anonymous tier was already at
// 429 "Too many requests" (~20h until its daily reset). Cache TTL tightens to
// the documented 10s for a registered client, 45s anonymous.
const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;

const CACHE_TTL_SECONDS = CLIENT_ID && CLIENT_SECRET ? 10 : 45;
const MAX_FLIGHTS = 400; // keeps the globe renderable until marker clustering (Phase 5) ships

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

// OpenSky's OAuth2 client-credentials flow (Keycloak-backed) — token is
// cached in memory and refreshed a minute before its real expiry (tokens
// verified live to last 1800s) so a request never races an expired token.
async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!response.ok) throw new Error(`OpenSky token request failed with status ${response.status}`);

  const json = await response.json();
  const { access_token: accessToken, expires_in: expiresInSeconds } = json as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = { accessToken, expiresAt: Date.now() + (expiresInSeconds - 60) * 1000 };
  return accessToken;
}

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
      const accessToken = await getAccessToken();
      const response = await fetch("https://opensky-network.org/api/states/all", {
        next: { revalidate: 0 },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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
