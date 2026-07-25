import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchCurrentWeather } from "@/lib/adapters/open-meteo";

const FIXTURE = {
  latitude: 51.5,
  longitude: -0.12,
  timezone: "Europe/London",
  current: {
    time: "2026-07-25T16:00",
    temperature_2m: 22.4,
    apparent_temperature: 21.8,
    relative_humidity_2m: 55,
    precipitation: 0,
    weather_code: 1,
    wind_speed_10m: 12.3,
    wind_direction_10m: 210,
    cloud_cover: 30,
    uv_index: 4.2,
  },
};

describe("fetchCurrentWeather", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("normalizes the Open-Meteo current-conditions shape", async () => {
    const weather = await fetchCurrentWeather(51.5, -0.12);
    expect(weather).toMatchObject({
      temperatureC: 22.4,
      apparentTemperatureC: 21.8,
      humidityPercent: 55,
      windSpeedKmh: 12.3,
      windDirectionDeg: 210,
      cloudCoverPercent: 30,
      uvIndex: 4.2,
      timezone: "Europe/London",
    });
  });

  it("defaults uvIndex to null when absent", async () => {
    // Different coordinates than the test above — the adapter's cache-aside
    // is keyed by rounded coordinate, so reusing the same point would return
    // the first test's cached value instead of exercising this fetch.
    const withoutUv = { ...FIXTURE, current: { ...FIXTURE.current, uv_index: null } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(withoutUv), { status: 200 })));
    const weather = await fetchCurrentWeather(10, 10);
    expect(weather.uvIndex).toBeNull();
  });
});
