import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchSatelliteGroup } from "@/lib/adapters/celestrak";

// Real CelesTrak FORMAT=tle shape verified live this session. CelesTrak's
// FORMAT=json is OMM (orbital elements), not TLE line strings — this
// adapter deliberately requests FORMAT=tle instead. See TODO.md.
const TLE_TEXT = `ISS (ZARYA)
1 25544U 98067A   26204.18538858  .00009623  00000+0  18183-3 0  9993
2 25544  51.6313 121.9488 0006905 328.2241  31.8329 15.49110422577336
POISK
1 36086U 09060A   26204.18538858  .00009623  00000+0  18183-3 0  9991
2 36086  51.6313 121.9488 0006905 328.2241  31.8329 15.49110422576631
`;

describe("fetchSatelliteGroup", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(TLE_TEXT, { status: 200 })),
    );
  });

  it("parses 3-line TLE blocks into satellite elements", async () => {
    const satellites = await fetchSatelliteGroup("stations");
    expect(satellites).toHaveLength(2);
    expect(satellites[0].name).toBe("ISS (ZARYA)");
    expect(satellites[0].noradId).toBe(25544);
    expect(satellites[0].tleLine1).toMatch(/^1 25544U/);
    expect(satellites[0].tleLine2).toMatch(/^2 25544/);
    expect(satellites[1].name).toBe("POISK");
    expect(satellites[1].noradId).toBe(36086);
  });
});
