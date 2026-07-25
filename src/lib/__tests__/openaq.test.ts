import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchNearestAirQuality } from "@/lib/adapters/openaq";

const LOCATIONS_FIXTURE = {
  results: [
    {
      id: 60,
      name: "Haringey Roadside - UKA00260",
      coordinates: { latitude: 51.599, longitude: -0.068 },
      distance: 11617.2,
      sensors: [
        { id: 88, parameter: { name: "no2", units: "µg/m³", displayName: "NO₂ mass" } },
        { id: 206, parameter: { name: "pm25", units: "µg/m³", displayName: "PM2.5" } },
      ],
    },
  ],
};

const LATEST_FIXTURE = {
  results: [
    { sensorsId: 88, value: 17.02, datetime: { utc: "2026-07-25T15:00:00Z" } },
    { sensorsId: 206, value: 10.0, datetime: { utc: "2026-07-25T15:00:00Z" } },
  ],
};

describe("fetchNearestAirQuality", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when OPENAQ_API_KEY is not configured", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "");
    await expect(fetchNearestAirQuality(51.5, -0.12)).rejects.toThrow(/OPENAQ_API_KEY/);
  });

  it("joins locations sensors with latest values by sensorsId", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "testkey");
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        const body = call === 1 ? LOCATIONS_FIXTURE : LATEST_FIXTURE;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );

    const result = await fetchNearestAirQuality(52.2, -1.3);
    expect(result).toMatchObject({
      stationId: 60,
      stationName: "Haringey Roadside - UKA00260",
      distanceMeters: 11617.2,
    });
    expect(result?.measurements).toHaveLength(2);
    expect(result?.measurements).toContainEqual({
      parameter: "no2",
      displayName: "NO₂ mass",
      value: 17.02,
      units: "µg/m³",
      measuredAt: "2026-07-25T15:00:00Z",
    });
  });

  it("returns null when no station is within range", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "testkey");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    const result = await fetchNearestAirQuality(0, 0);
    expect(result).toBeNull();
  });
});
