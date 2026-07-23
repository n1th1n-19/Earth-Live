import { describe, expect, it } from "vitest";
import { propagateTle } from "@/lib/satellite-propagation";

// Sample ISS TLE (format is what's under test — SGP4 propagation, not
// freshness of the elements).
const ISS_LINE1 = "1 25544U 98067A   24010.50000000  .00016717  00000-0  10270-3 0  9993";
const ISS_LINE2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49560219100000";

describe("propagateTle", () => {
  it("returns a plausible ISS position (LEO altitude, valid lat/lon range)", () => {
    const result = propagateTle(ISS_LINE1, ISS_LINE2, new Date("2024-01-10T12:00:00Z"));
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeGreaterThanOrEqual(-90);
    expect(result!.latitude).toBeLessThanOrEqual(90);
    expect(result!.longitude).toBeGreaterThanOrEqual(-180);
    expect(result!.longitude).toBeLessThanOrEqual(180);
    // ISS orbits at roughly 400-420km altitude.
    expect(result!.heightKm).toBeGreaterThan(300);
    expect(result!.heightKm).toBeLessThan(500);
  });

  it("drifts in longitude after one orbit (~92min) due to Earth's rotation", () => {
    // Latitude alone can coincidentally repeat near an orbit's ascending
    // node; longitude reliably drifts ~22.5° per ISS orbit as Earth rotates
    // underneath it, so it's the more robust signal that time advanced.
    const t1 = new Date("2024-01-10T12:00:00Z");
    const t2 = new Date("2024-01-10T13:32:00Z");
    const p1 = propagateTle(ISS_LINE1, ISS_LINE2, t1);
    const p2 = propagateTle(ISS_LINE1, ISS_LINE2, t2);
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(Math.abs(p1!.longitude - p2!.longitude)).toBeGreaterThan(5);
  });
});
