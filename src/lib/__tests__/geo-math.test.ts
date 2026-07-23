import { describe, expect, it } from "vitest";
import { haversineDistanceKm, totalPathDistanceKm } from "@/lib/geo-math";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical points", () => {
    const point = { latitude: 40.7128, longitude: -74.006 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it("matches the known NYC-London great-circle distance (~5570km)", () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const distance = haversineDistanceKm(nyc, london);
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5600);
  });

  it("is symmetric", () => {
    const a = { latitude: 10, longitude: 20 };
    const b = { latitude: -5, longitude: 100 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 8);
  });
});

describe("totalPathDistanceKm", () => {
  it("returns 0 for fewer than 2 points", () => {
    expect(totalPathDistanceKm([])).toBe(0);
    expect(totalPathDistanceKm([{ latitude: 0, longitude: 0 }])).toBe(0);
  });

  it("sums consecutive segment distances", () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 1 };
    const c = { latitude: 0, longitude: 2 };
    const total = totalPathDistanceKm([a, b, c]);
    const expected = haversineDistanceKm(a, b) + haversineDistanceKm(b, c);
    expect(total).toBeCloseTo(expected, 8);
  });
});
