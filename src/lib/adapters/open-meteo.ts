import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// Open-Meteo current-conditions adapter.
// Source, auth, rate limit, and cache TTL: docs/05-api-integration-guide.md §5.1, §5.12.
// No API key — free non-commercial policy. Attribution required: "Weather data
// by Open-Meteo.com" (CC BY 4.0), rendered in the app's credits panel.

const CACHE_TTL_SECONDS = 15 * 60; // matches the 15-minute cadence documented in §5.12

const openMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    cloud_cover: z.number(),
    uv_index: z.number().nullable().optional(),
  }),
});

export type OpenMeteoCurrent = z.infer<typeof openMeteoResponseSchema>;

export interface CurrentWeather {
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  cloudCoverPercent: number;
  uvIndex: number | null;
}

function roundCoord(value: number): number {
  // Coarse bucketing keeps the cache key stable for nearby requests without
  // meaningfully degrading accuracy for a point forecast.
  return Math.round(value * 20) / 20; // ~5.5km grid at the equator
}

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<CurrentWeather> {
  const roundedLat = roundCoord(latitude);
  const roundedLon = roundCoord(longitude);
  const cacheKey = `open-meteo:current:${roundedLat}:${roundedLon}`;

  const started = Date.now();
  let statusCode: number | null = null;
  let errorMessage: string | undefined;

  try {
    const { value, cacheHit } = await cacheAside(cacheKey, CACHE_TTL_SECONDS, async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(roundedLat));
      url.searchParams.set("longitude", String(roundedLon));
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "cloud_cover",
          "uv_index",
        ].join(","),
      );
      url.searchParams.set("timezone", "auto");

      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) {
        throw new Error(`Open-Meteo request failed with status ${response.status}`);
      }

      const json = await response.json();
      const parsed = openMeteoResponseSchema.parse(json);
      return normalize(parsed);
    });

    logApiCall({
      source: "open_meteo_current",
      endpoint: "/v1/forecast",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logApiCall({
      source: "open_meteo_current",
      endpoint: "/v1/forecast",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage,
    });
    throw err;
  }
}

function normalize(data: OpenMeteoCurrent): CurrentWeather {
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    observedAt: data.current.time,
    temperatureC: data.current.temperature_2m,
    apparentTemperatureC: data.current.apparent_temperature,
    humidityPercent: data.current.relative_humidity_2m,
    precipitationMm: data.current.precipitation,
    weatherCode: data.current.weather_code,
    windSpeedKmh: data.current.wind_speed_10m,
    windDirectionDeg: data.current.wind_direction_10m,
    cloudCoverPercent: data.current.cloud_cover,
    uvIndex: data.current.uv_index ?? null,
  };
}
