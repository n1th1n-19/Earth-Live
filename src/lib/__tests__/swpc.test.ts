import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchSpaceWeather } from "@/lib/adapters/swpc";

// Real SWPC shape verified live this session — array of objects, not the
// stale array-of-arrays-with-header-row assumption. See TODO.md.
const FIXTURE = [
  { time_tag: "2026-07-25T09:00:00", Kp: 2.33, a_running: 9, station_count: 8 },
  { time_tag: "2026-07-25T12:00:00", Kp: 3.67, a_running: 15, station_count: 8 },
];

describe("fetchSpaceWeather", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("returns the latest (last) Kp row", async () => {
    const result = await fetchSpaceWeather();
    expect(result).toEqual({ kpIndex: 3.67, observedAt: "2026-07-25T12:00:00" });
  });
});
