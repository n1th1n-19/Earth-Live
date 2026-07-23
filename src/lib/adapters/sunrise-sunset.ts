import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// sunrise-sunset.org — docs/05-api-integration-guide.md §5.8. No key.
// Deterministic per coordinate+day, so a 24h cache TTL is exact, not stale.
const CACHE_TTL_SECONDS = 24 * 60 * 60;

// day_length is a plain integer count of seconds (not "HH:MM:SS" — that was
// a stale assumption; verified against the live response).
const responseSchema = z.object({
  status: z.string(),
  results: z.object({
    sunrise: z.string(),
    sunset: z.string(),
    solar_noon: z.string(),
    day_length: z.number(),
    civil_twilight_begin: z.string(),
    civil_twilight_end: z.string(),
  }),
});

export interface SunTimes {
  sunrise: string;
  sunset: string;
  solarNoon: string;
  dayLengthSeconds: number;
}

function roundCoord(value: number): number {
  return Math.round(value * 10) / 10; // ~11km grid — plenty for sun-time purposes
}

export async function fetchSunTimes(latitude: number, longitude: number): Promise<SunTimes> {
  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);
  const dateKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `sunrise-sunset:${lat}:${lon}:${dateKey}`;

  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;
      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`sunrise-sunset.org failed with status ${response.status}`);

      const json = await response.json();
      const parsed = responseSchema.parse(json);
      return normalize(parsed);
    });

    logApiCall({
      source: "sunrise_sunset",
      endpoint: "/json",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "sunrise_sunset",
      endpoint: "/json",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function normalize(data: z.infer<typeof responseSchema>): SunTimes {
  return {
    sunrise: data.results.sunrise,
    sunset: data.results.sunset,
    solarNoon: data.results.solar_noon,
    dayLengthSeconds: data.results.day_length,
  };
}
