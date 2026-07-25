import { describe, expect, it, vi, beforeEach } from "vitest";
import { geocode } from "@/lib/adapters/nominatim";

const FIXTURE = [
  { display_name: "Paris, Île-de-France, France", lat: "48.8566", lon: "2.3522", type: "city", class: "place" },
];

describe("geocode", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
    );
  });

  it("normalizes Nominatim results and parses coordinates as numbers", async () => {
    const results = await geocode("paris");
    expect(results).toEqual([{ label: "Paris, Île-de-France, France", latitude: 48.8566, longitude: 2.3522, type: "city" }]);
  });

  it("returns an empty array without calling fetch for short queries", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const results = await geocode("p");
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
