import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchSunTimes } from "@/lib/adapters/sunrise-sunset";

// Real shape verified live this session — day_length is a plain integer
// seconds count, not an "HH:MM:SS" string. See TODO.md.
const FIXTURE = {
  status: "OK",
  results: {
    sunrise: "2026-07-23T04:09:33+00:00",
    sunset: "2026-07-23T20:04:28+00:00",
    solar_noon: "2026-07-23T12:07:00+00:00",
    day_length: 57295,
    civil_twilight_begin: "2026-07-23T03:28:55+00:00",
    civil_twilight_end: "2026-07-23T20:45:05+00:00",
  },
};

describe("fetchSunTimes", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("passes day_length through as-is (already seconds)", async () => {
    const result = await fetchSunTimes(51.5, -0.12);
    expect(result).toEqual({
      sunrise: "2026-07-23T04:09:33+00:00",
      sunset: "2026-07-23T20:04:28+00:00",
      solarNoon: "2026-07-23T12:07:00+00:00",
      dayLengthSeconds: 57295,
    });
  });
});
