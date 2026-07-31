import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Static-data sanity check, same spirit as volcanoes-data.test.ts: this file
// is generated once from OurAirports and committed, so a bad regeneration
// should fail CI rather than silently shipping empty or malformed data.
describe("airports.geojson", () => {
  const geojson = JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/airports.geojson"), "utf8"),
  );

  it("has the expected real airport count and valid coordinates", () => {
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBe(5273);

    for (const f of geojson.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(["large", "medium"]).toContain(f.properties.size);
    }
  });

  it("includes well-known major airports", () => {
    const codes = new Set(
      geojson.features.map((f: { properties: { icao: string | null } }) => f.properties.icao),
    );
    // Heathrow, LAX, Narita — real ICAO codes, real presence check.
    expect(codes.has("EGLL")).toBe(true);
    expect(codes.has("KLAX")).toBe(true);
    expect(codes.has("RJAA")).toBe(true);
  });
});
