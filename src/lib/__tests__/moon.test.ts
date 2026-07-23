import { describe, expect, it } from "vitest";
import { getMoonInfo } from "@/lib/moon";

describe("getMoonInfo", () => {
  it("returns a valid phase name and illumination percentage for a known date", () => {
    // 2024-01-11 was a documented new moon (NASA/USNO).
    const info = getMoonInfo(new Date("2024-01-11T12:00:00Z"));
    expect(info.phaseName).toBe("New Moon");
    expect(info.illuminationPercent).toBeLessThan(15);
  });

  it("clamps illumination between 0 and 100 for an arbitrary date", () => {
    const info = getMoonInfo(new Date("2026-07-23T00:00:00Z"));
    expect(info.illuminationPercent).toBeGreaterThanOrEqual(0);
    expect(info.illuminationPercent).toBeLessThanOrEqual(100);
    expect(typeof info.phaseName).toBe("string");
  });
});
