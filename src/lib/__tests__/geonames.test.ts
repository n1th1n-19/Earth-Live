import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchTimezone } from "@/lib/adapters/geonames";

describe("fetchTimezone", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when GEONAMES_USERNAME is not configured", async () => {
    vi.stubEnv("GEONAMES_USERNAME", "");
    await expect(fetchTimezone(51.5, -0.12)).rejects.toThrow(/GEONAMES_USERNAME/);
  });

  it("normalizes the timezone response when configured", async () => {
    vi.stubEnv("GEONAMES_USERNAME", "testuser");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ timezoneId: "Europe/London", gmtOffset: 0, dstOffset: 1 }), { status: 200 }),
      ),
    );
    // Distinct coordinates from other tests in this file to avoid a
    // cache-aside hit on the (now-populated) same-key entry.
    const result = await fetchTimezone(52.1, -1.5);
    expect(result).toEqual({ timezoneId: "Europe/London", gmtOffsetHours: 0 });
  });
});
