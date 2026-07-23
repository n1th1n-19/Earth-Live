import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchRecentEarthquakes } from "@/lib/adapters/usgs-earthquakes";

const FIXTURE = {
  features: [
    {
      id: "us7000abcd",
      properties: {
        mag: 5.2,
        place: "120km SE of Tokyo, Japan",
        time: 1700000000000,
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
        tsunami: 1,
        sig: 456,
      },
      geometry: { type: "Point", coordinates: [141.5, 35.2, 35.4] },
    },
  ],
};

describe("fetchRecentEarthquakes", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("normalizes USGS GeoJSON features into flat Earthquake objects", async () => {
    const quakes = await fetchRecentEarthquakes();
    expect(quakes).toHaveLength(1);
    expect(quakes[0]).toMatchObject({
      id: "us7000abcd",
      magnitude: 5.2,
      place: "120km SE of Tokyo, Japan",
      longitude: 141.5,
      latitude: 35.2,
      depthKm: 35.4,
      tsunami: true,
      significance: 456,
    });
  });

  it("converts the epoch time into an ISO string", async () => {
    const quakes = await fetchRecentEarthquakes();
    expect(quakes[0].occurredAt).toBe(new Date(1700000000000).toISOString());
  });
});
