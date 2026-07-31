import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchFlightRoute } from "@/lib/adapters/adsbdb";

const ROUTE_FIXTURE = {
  response: {
    flightroute: {
      callsign: "BAW123",
      origin: { name: "London Heathrow Airport", icao_code: "EGLL", iata_code: "LHR", latitude: 51.4706, longitude: -0.461941 },
      destination: { name: "Hamad International Airport", icao_code: "OTHH", iata_code: "DOH", latitude: 25.273056, longitude: 51.608056 },
    },
  },
};

describe("fetchFlightRoute", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", undefined);
  });

  it("normalizes a resolvable callsign into origin/destination coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(ROUTE_FIXTURE), { status: 200 })),
    );
    const route = await fetchFlightRoute("BAW123-test-a");
    expect(route).toEqual({
      origin: { name: "London Heathrow Airport", latitude: 51.4706, longitude: -0.461941 },
      destination: { name: "Hamad International Airport", latitude: 25.273056, longitude: 51.608056 },
    });
  });

  it("returns null (no synthesized fallback) for an unresolvable callsign", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ response: "unknown callsign" }), { status: 404 })),
    );
    const route = await fetchFlightRoute("ZZZZZZ-test-b");
    expect(route).toBeNull();
  });
});
