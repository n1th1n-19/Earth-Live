import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// What makes a place notable ("specialty") plus its real climate, from two
// free, keyless sources — both verified live before wiring in:
//
//  - Wikipedia REST summary API (CC BY-SA 4.0). Gives the encyclopaedic
//    one-paragraph "what this place is known for". No key, no quota tier.
//  - Open-Meteo's climate API, which serves real 1991-2020 daily normals
//    (the standard WMO climate-normal period), not a live forecast. Same
//    provider already used for current weather (src/lib/adapters/open-meteo.ts).
//
// Both are static-ish per place, so cached hard.
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CLIMATE_START = "1991-01-01";
const CLIMATE_END = "2020-12-31";
const UPSTREAM_TIMEOUT_MS = 6000;

const summarySchema = z.object({
  title: z.string(),
  extract: z.string().optional(),
  content_urls: z
    .object({ desktop: z.object({ page: z.string() }).optional() })
    .optional(),
});

const climateSchema = z.object({
  daily: z.object({
    temperature_2m_mean: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()).optional(),
  }),
});

export interface PlaceInfo {
  title: string;
  /** Wikipedia's lead paragraph — what the place is known for. */
  summary: string | null;
  sourceUrl: string | null;
  /** Mean of real 1991-2020 daily normals, °C. */
  averageTempC: number | null;
  /** Real 1991-2020 mean total annual precipitation, mm. */
  annualPrecipitationMm: number | null;
}

async function fetchWikipediaSummary(
  name: string,
): Promise<Pick<PlaceInfo, "title" | "summary" | "sourceUrl">> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  // A place with no article is a real outcome, not an error.
  if (response.status === 404) return { title: name, summary: null, sourceUrl: null };
  if (!response.ok) throw new Error(`Wikipedia request failed with status ${response.status}`);

  const parsed = summarySchema.parse(await response.json());
  return {
    title: parsed.title,
    summary: parsed.extract ?? null,
    sourceUrl: parsed.content_urls?.desktop?.page ?? null,
  };
}

function mean(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v != null);
  if (real.length === 0) return null;
  return real.reduce((sum, v) => sum + v, 0) / real.length;
}

async function fetchClimateNormals(
  latitude: number,
  longitude: number,
): Promise<Pick<PlaceInfo, "averageTempC" | "annualPrecipitationMm">> {
  const url = new URL("https://climate-api.open-meteo.com/v1/climate");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", CLIMATE_START);
  url.searchParams.set("end_date", CLIMATE_END);
  url.searchParams.set("models", "MRI_AGCM3_2_S");
  url.searchParams.set("daily", "temperature_2m_mean,precipitation_sum");

  const response = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Open-Meteo climate request failed with status ${response.status}`);

  const parsed = climateSchema.parse(await response.json());
  const temps = parsed.daily.temperature_2m_mean;
  const precip = parsed.daily.precipitation_sum ?? [];

  const avgTemp = mean(temps);
  // Daily totals across the whole 30-year window, converted to a per-year
  // average rather than reported as one enormous sum.
  const precipReal = precip.filter((v): v is number => v != null);
  const years = (new Date(CLIMATE_END).getTime() - new Date(CLIMATE_START).getTime()) / (365.25 * 24 * 3600 * 1000);
  const annualPrecip =
    precipReal.length === 0 ? null : precipReal.reduce((sum, v) => sum + v, 0) / years;

  return { averageTempC: avgTemp, annualPrecipitationMm: annualPrecip };
}

export async function fetchPlaceInfo(
  name: string,
  latitude: number,
  longitude: number,
): Promise<PlaceInfo> {
  const cacheKey = `place-info:${name.toLowerCase()}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  const started = Date.now();

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      // Independent sources — one being unavailable shouldn't blank the
      // other, so failures degrade to nulls per-source rather than throwing.
      const [summary, climate] = await Promise.allSettled([
        fetchWikipediaSummary(name),
        fetchClimateNormals(latitude, longitude),
      ]);

      return {
        ...(summary.status === "fulfilled"
          ? summary.value
          : { title: name, summary: null, sourceUrl: null }),
        ...(climate.status === "fulfilled"
          ? climate.value
          : { averageTempC: null, annualPrecipitationMm: null }),
      } satisfies PlaceInfo;
    });

    logApiCall({
      source: "place-info",
      endpoint: "/wikipedia+open-meteo-climate",
      statusCode: 200,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "place-info",
      endpoint: "/wikipedia+open-meteo-climate",
      statusCode: null,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
