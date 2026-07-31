import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ROUTE_FIXTURE = {
  response: {
    flightroute: {
      callsign: "BAW123",
      origin: { name: "London Heathrow Airport", icao_code: "EGLL", iata_code: "LHR", latitude: 51.4706, longitude: -0.461941 },
      destination: { name: "Hamad International Airport", icao_code: "OTHH", iata_code: "DOH", latitude: 25.273056, longitude: 51.608056 },
    },
  },
};

// The adapter caches by callsign, so without resetting the module registry
// between cases the second test would read the first one's cached value
// instead of exercising the 404 path. Resetting also lets both tests use the
// same realistic callsign rather than fake unique suffixes.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshAdapter() {
  return (await import("@/lib/adapters/adsbdb")).fetchFlightRoute;
}

describe("fetchFlightRoute", () => {
  it("normalizes a resolvable callsign into origin/destination coordinates", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ROUTE_FIXTURE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const fetchRoute = await freshAdapter();
    const route = await fetchRoute("  baw123  ");

    expect(route).toEqual({
      origin: { name: "London Heathrow Airport", latitude: 51.4706, longitude: -0.461941 },
      destination: { name: "Hamad International Airport", latitude: 25.273056, longitude: 51.608056 },
    });
    // Trimmed, upper-cased and URL-encoded before it reaches adsbdb.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.adsbdb.com/v0/callsign/BAW123",
      expect.anything(),
    );
  });

  it("returns null (no synthesized fallback) for an unresolvable callsign", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ response: "unknown callsign" }), { status: 404 })),
    );

    const fetchRoute = await freshAdapter();
    expect(await fetchRoute("BAW123")).toBeNull();
  });

  it("caches an unresolvable callsign instead of re-hitting adsbdb", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ response: "unknown callsign" }), { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const fetchRoute = await freshAdapter();
    await fetchRoute("BAW123");
    await fetchRoute("BAW123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
