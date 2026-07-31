import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Static-data sanity check, same spirit as the capitals bundle: this file is
// generated once from a live upstream and then committed, so nothing
// re-fetches it — but a bad regeneration should still fail CI rather than
// silently shipping malformed or empty data.
describe("volcanoes.geojson", () => {
  const geojson = JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/volcanoes.geojson"), "utf8"),
  );

  it("has the expected real volcano count and valid coordinates", () => {
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBe(1196);

    for (const f of geojson.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(typeof f.properties.name).toBe("string");
      expect(f.properties.name.length).toBeGreaterThan(0);
    }
  });

  it("includes well-known active volcanoes", () => {
    const names = new Set(geojson.features.map((f: { properties: { name: string } }) => f.properties.name));
    expect([...names].some((n) => String(n).includes("Etna"))).toBe(true);
    expect([...names].some((n) => String(n).includes("Kilauea"))).toBe(true);
  });
});
