import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// NOAA Space Weather Prediction Center — docs/05-api-integration-guide.md §5.10.
// No key. Planetary Kp index, polled every 5 minutes per the documented cadence.
const CACHE_TTL_SECONDS = 5 * 60;

const kpResponseSchema = z.array(
  z.object({
    time_tag: z.string(),
    Kp: z.number(),
    a_running: z.number(),
    station_count: z.number(),
  }),
);

export interface SpaceWeather {
  kpIndex: number;
  observedAt: string;
}

export async function fetchSpaceWeather(): Promise<SpaceWeather> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside("swpc:kp-index", CACHE_TTL_SECONDS, async () => {
      const response = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", {
        next: { revalidate: 0 },
      });
      statusCode = response.status;
      if (!response.ok) throw new Error(`SWPC request failed with status ${response.status}`);

      const json = await response.json();
      const rows = kpResponseSchema.parse(json);
      const latest = rows[rows.length - 1];
      if (!latest) throw new Error("SWPC returned no Kp index rows");

      return { observedAt: latest.time_tag, kpIndex: latest.Kp };
    });

    logApiCall({
      source: "noaa_swpc_kp",
      endpoint: "/products/noaa-planetary-k-index.json",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "noaa_swpc_kp",
      endpoint: "/products/noaa-planetary-k-index.json",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
