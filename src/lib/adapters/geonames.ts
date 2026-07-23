import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// GeoNames — docs/05-api-integration-guide.md §5.5/§5.8.
// UNTESTED: requires a free GEONAMES_USERNAME (geonames.org) which is not
// configured in this environment. Note the docs' own preferred path for the
// user's own device: the browser's zero-cost `Intl.DateTimeFormat` API
// (no adapter needed) — this adapter is for arbitrary map coordinates the
// user has panned to, which is the only case that actually needs it.
const CACHE_TTL_SECONDS = 24 * 60 * 60; // timezone boundaries don't move

const responseSchema = z.object({
  timezoneId: z.string(),
  gmtOffset: z.number(),
  dstOffset: z.number(),
});

export interface TimezoneInfo {
  timezoneId: string;
  gmtOffsetHours: number;
}

export async function fetchTimezone(latitude: number, longitude: number): Promise<TimezoneInfo> {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) {
    throw new Error("GEONAMES_USERNAME is not configured — see .env.example");
  }

  const cacheKey = `geonames:timezone:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = `http://api.geonames.org/timezoneJSON?lat=${latitude}&lng=${longitude}&username=${username}`;
      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`GeoNames request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = responseSchema.parse(json);
      return { timezoneId: parsed.timezoneId, gmtOffsetHours: parsed.gmtOffset };
    });

    logApiCall({
      source: "geonames_timezone",
      endpoint: "/timezoneJSON",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "geonames_timezone",
      endpoint: "/timezoneJSON",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
