import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchFlights } from "@/lib/adapters/opensky";

// Real OpenSky state-vector shape (positional array) — docs/05-api-integration-guide.md §5.6.
const FIXTURE = {
  time: 1700000000,
  states: [
    ["a1b2c3", "UAL123  ", "United States", 1700000000, 1700000000, -74.0, 40.7, 10000, false, 230, 270, 0, null, 10200, null, false, 0],
    ["d4e5f6", null, "France", 1700000000, 1700000000, null, null, null, true, null, null, null, null, null, null, false, 0],
  ],
};

describe("fetchFlights", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("normalizes state vectors and filters out on-ground/positionless flights", async () => {
    const flights = await fetchFlights();
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({
      icao24: "a1b2c3",
      callsign: "UAL123",
      originCountry: "United States",
      latitude: 40.7,
      longitude: -74.0,
      altitudeM: 10000,
      velocityMs: 230,
      headingDeg: 270,
      onGround: false,
    });
  });
});
