import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchActiveFires } from "@/lib/adapters/firms";

const CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
34.05,-118.25,320.5,0.4,0.4,2026-07-25,1345,N,VIIRS,nominal,2.0NRT,290.1,5.2,D
40.71,-74.01,305.2,0.4,0.4,2026-07-25,0130,N,VIIRS,high,2.0NRT,280.3,3.1,N
`;

describe("fetchActiveFires", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when FIRMS_MAP_KEY is not configured", async () => {
    vi.stubEnv("FIRMS_MAP_KEY", "");
    await expect(fetchActiveFires()).rejects.toThrow(/FIRMS_MAP_KEY/);
  });

  it("parses FIRMS CSV rows into fire detections", async () => {
    vi.stubEnv("FIRMS_MAP_KEY", "testkey");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(CSV, { status: 200 })));

    const fires = await fetchActiveFires();
    expect(fires).toHaveLength(2);
    expect(fires[0]).toMatchObject({
      latitude: 34.05,
      longitude: -118.25,
      brightness: 320.5,
      confidence: "nominal",
      satellite: "N",
    });
    expect(fires[0].acquiredAt).toBe("2026-07-25T13:45:00Z");
  });
});
