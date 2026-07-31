import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Trimmed from a real GDACS response captured live, keeping the fields the
// adapter actually reads plus the shapes that caused trouble: a Red alert, an
// Orange one, an unrecognised event code, and an entry with no usable
// position.
const FIXTURE = {
  features: [
    {
      geometry: { type: "Point", coordinates: [129.92, 43.53] },
      properties: {
        eventid: 1104051,
        eventtype: "FL",
        eventname: "",
        name: "Flood in China",
        description: "Flood in China",
        alertlevel: "Red",
        country: "China",
        fromdate: "2026-07-25T01:00:00",
        severitydata: { severitytext: "Magnitude 0 " },
      },
    },
    {
      geometry: { type: "Point", coordinates: [-72.3, 18.5] },
      properties: {
        eventid: 99,
        eventtype: "TC",
        eventname: "Cyclone BERYL",
        alertlevel: "Orange",
        country: "Haiti",
        fromdate: "2026-07-28T00:00:00",
        severitydata: { severitytext: null },
      },
    },
    {
      geometry: { type: "Point", coordinates: [10, 20] },
      properties: { eventid: 7, eventtype: "ZZ", name: "Unknown kind", alertlevel: "Orange" },
    },
    {
      geometry: { type: "Point", coordinates: [Number.NaN, Number.NaN] },
      properties: { eventid: 8, eventtype: "EQ", name: "No position", alertlevel: "Red" },
    },
  ],
};

beforeEach(() => {
  // The adapter caches by a fixed key, so without resetting modules the
  // second test would read the first one's cached value.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshAdapter() {
  return (await import("@/lib/adapters/gdacs")).fetchDisasters;
}

describe("fetchDisasters", () => {
  it("normalizes GDACS events and drops ones with no usable position", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );

    const disasters = await (await freshAdapter())();

    // The NaN-coordinate entry is dropped rather than plotted at 0,0.
    expect(disasters).toHaveLength(3);

    const flood = disasters[0];
    expect(flood.id).toBe("FL-1104051");
    expect(flood.typeLabel).toBe("Flood");
    expect(flood.alertLevel).toBe("Red");
    expect(flood.latitude).toBe(43.53);
    expect(flood.longitude).toBe(129.92);
    // eventname is blank here, so it falls back to `name`.
    expect(flood.title).toBe("Flood in China");
    expect(flood.severityText).toBe("Magnitude 0");

    // A non-empty eventname wins over the other title candidates.
    expect(disasters[1].title).toBe("Cyclone BERYL");
    expect(disasters[1].typeLabel).toBe("Tropical cyclone");
    expect(disasters[1].severityText).toBeNull();

    // An unrecognised code degrades to the raw code rather than throwing.
    expect(disasters[2].typeLabel).toBe("ZZ");
  });

  it("requests only the Orange and Red alert tiers", async () => {
    // Typed as taking the real fetch arguments so the assertion below can
    // read the requested URL off mock.calls.
    const fetchMock: ReturnType<typeof vi.fn<(input: unknown, init?: unknown) => Promise<Response>>> =
      vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await (await freshAdapter())();

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("alertlevel=Orange;Red");
  });
});
