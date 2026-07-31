import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// What makes a place notable ("specialty") plus its real climate, from two
// free, keyless sources — both verified live before wiring in:
//
//  - Wikipedia REST summary API (CC BY-SA 4.0). Gives the encyclopaedic
//    one-paragraph "what this place is known for". No key, no quota tier.
//  - Open-Meteo's ERA5 archive API for climate averages. ERA5 is a
//    *reanalysis* — real observations assimilated onto a grid — so these are
//    measured historical conditions, not a forecast and not a model
//    projection. Same provider already used for current weather
//    (src/lib/adapters/open-meteo.ts).
//
//    This deliberately does NOT use Open-Meteo's /v1/climate endpoint: that
//    serves downscaled CMIP6 *model* output (MRI_AGCM3_2_S and friends),
//    which is a simulation, and labelling it "WMO climate normals" in the UI
//    would have overclaimed what the number actually is.
//
// Both are static-ish per place, so cached hard.
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// A 10-year window: long enough to average out individual weather years,
// while keeping the response ~80KB instead of the ~250KB a 30-year daily
// pull cost (which showed up as multi-second first loads).
const CLIMATE_START = "2015-01-01";
const CLIMATE_END = "2024-12-31";
export const CLIMATE_PERIOD_LABEL = "2015-2024";
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
  /** Mean daily temperature across CLIMATE_PERIOD_LABEL (ERA5), °C. */
  averageTempC: number | null;
  /** Mean total precipitation per year across CLIMATE_PERIOD_LABEL, mm. */
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

async function fetchClimateAverages(
  latitude: number,
  longitude: number,
): Promise<Pick<PlaceInfo, "averageTempC" | "annualPrecipitationMm">> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", CLIMATE_START);
  url.searchParams.set("end_date", CLIMATE_END);
  url.searchParams.set("daily", "temperature_2m_mean,precipitation_sum");
  url.searchParams.set("timezone", "UTC");

  const response = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Open-Meteo archive request failed with status ${response.status}`);

  const parsed = climateSchema.parse(await response.json());
  const avgTemp = mean(parsed.daily.temperature_2m_mean);

  // Scale by the days actually returned with a reading, not by the nominal
  // window length — a grid cell with gaps would otherwise under-report.
  const precipDays = (parsed.daily.precipitation_sum ?? []).filter((v): v is number => v != null);
  const annualPrecip =
    precipDays.length === 0
      ? null
      : (precipDays.reduce((sum, v) => sum + v, 0) / precipDays.length) * 365.25;

  // Only the two scalars escape this function; the daily arrays go out of
  // scope here rather than being held in the cached value.
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
        fetchClimateAverages(latitude, longitude),
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
      endpoint: "/wikipedia+open-meteo-archive",
      statusCode: 200,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "place-info",
      endpoint: "/wikipedia+open-meteo-archive",
      statusCode: null,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
