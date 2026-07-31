import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mirrors the real api.weather.gov shape, including the dominant case: most
// active alerts arrive with `geometry: null` and describe their area by zone
// reference instead (51 of 62 when measured live).
const SQUARE = [
  [
    [-100, 40],
    [-99, 40],
    [-99, 41],
    [-100, 41],
    [-100, 40],
  ],
];

const FIXTURE = {
  features: [
    {
      geometry: { type: "Polygon", coordinates: SQUARE },
      properties: {
        id: "urn:oid:alert.1",
        event: "Tornado Warning",
        severity: "Extreme",
        headline: "Tornado Warning issued...",
        areaDesc: "Douglas, KS",
        senderName: "NWS Topeka KS",
        expires: "2026-07-31T18:00:00-05:00",
      },
    },
    {
      geometry: { type: "MultiPolygon", coordinates: [SQUARE, SQUARE] },
      properties: { id: "urn:oid:alert.2", event: "Flood Warning", severity: "Severe" },
    },
    // Zone-referenced alert: no geometry, so it cannot be placed on a globe
    // without a separate boundary lookup per zone.
    {
      geometry: null,
      properties: { id: "urn:oid:alert.3", event: "Extreme Heat Warning", severity: "Severe" },
    },
    // Degenerate ring — fewer than 3 positions is not a drawable area.
    {
      geometry: { type: "Polygon", coordinates: [[[-100, 40], [-99, 40]]] },
      properties: { id: "urn:oid:alert.4", event: "High Wind Watch", severity: "Severe" },
    },
  ],
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshAdapter() {
  return (await import("@/lib/adapters/nws-alerts")).fetchWeatherAlerts;
}

describe("fetchWeatherAlerts", () => {
  it("keeps only alerts with drawable geometry and flattens their rings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );

    const alerts = await (await freshAdapter())();

    // The zone-only and degenerate-ring alerts are both dropped.
    expect(alerts.map((a) => a.event)).toEqual(["Tornado Warning", "Flood Warning"]);

    const tornado = alerts[0];
    expect(tornado.severity).toBe("Extreme");
    expect(tornado.rings).toHaveLength(1);
    // Flattened to [lon, lat, lon, lat, …] for Cartesian3.fromDegreesArray.
    expect(tornado.rings[0].slice(0, 4)).toEqual([-100, 40, -99, 40]);
    expect(tornado.latitude).toBeCloseTo(40.4, 1);
    expect(tornado.longitude).toBeCloseTo(-99.6, 1);

    // A MultiPolygon yields one ring per part.
    expect(alerts[1].rings).toHaveLength(2);
  });

  it("sends the required User-Agent and requests only Extreme/Severe", async () => {
    const fetchMock: ReturnType<
      typeof vi.fn<(input: unknown, init?: { headers?: Record<string, string> }) => Promise<Response>>
    > = vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await (await freshAdapter())();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("severity=Extreme,Severe");
    // api.weather.gov rejects requests that don't identify the caller.
    expect(init?.headers?.["User-Agent"]).toBeTruthy();
  });
});
