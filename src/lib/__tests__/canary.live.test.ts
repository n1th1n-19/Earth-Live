import { describe, expect, it } from "vitest";
import { fetchRecentEarthquakes } from "@/lib/adapters/usgs-earthquakes";
import { fetchCurrentWeather } from "@/lib/adapters/open-meteo";
import { fetchSatelliteGroup } from "@/lib/adapters/celestrak";
import { fetchSunTimes } from "@/lib/adapters/sunrise-sunset";
import { fetchSpaceWeather } from "@/lib/adapters/swpc";
import { fetchFlightRoute } from "@/lib/adapters/adsbdb";
import { fetchPlaceInfo } from "@/lib/adapters/place-info";

// Live upstream canary — the ONLY tests in this repo that touch the real
// network. Everything under the normal `npm test` run is fixture-based and
// stays offline/deterministic; this file is opt-in via CANARY=1 and is run on
// a schedule by .github/workflows/canary.yml.
//
// The point is schema drift. Each adapter zod-parses its upstream response,
// so calling it against the live API fails loudly the day a provider renames
// or drops a field — which is exactly the class of breakage that otherwise
// only shows up as an empty panel in production. Three such breaks (CelesTrak
// TLE format, SWPC object shape, sunrise-sunset integer day_length) were
// found by hand earlier; this is the automated version of that check.
//
// Only keyless upstreams are covered, so the workflow needs no secrets.
// FIRMS, OpenAQ, GeoNames and NASA DONKI all require API keys and are left
// out rather than silently skipped in a way that looks like a pass.
const CANARY = process.env.CANARY === "1";

const PARIS = { lat: 48.85, lon: 2.35 };

describe.skipIf(!CANARY)("live upstream canary", () => {
  it("USGS earthquakes still parses", async () => {
    const quakes = await fetchRecentEarthquakes();
    expect(Array.isArray(quakes)).toBe(true);
    // The all_day feed is never empty in practice — a zero-length result
    // means the feed shape changed, not that the planet went quiet.
    expect(quakes.length).toBeGreaterThan(0);
    expect(typeof quakes[0].latitude).toBe("number");
  }, 60_000);

  it("Open-Meteo current weather still parses", async () => {
    const weather = await fetchCurrentWeather(PARIS.lat, PARIS.lon);
    expect(typeof weather.temperatureC).toBe("number");
  }, 30_000);

  it("CelesTrak TLEs still parse and contain the ISS", async () => {
    const stations = await fetchSatelliteGroup("stations");
    expect(stations.length).toBeGreaterThan(0);
    expect(stations.some((s) => s.name.includes("ISS"))).toBe(true);
  }, 30_000);

  it("sunrise-sunset still parses", async () => {
    const sun = await fetchSunTimes(PARIS.lat, PARIS.lon);
    expect(Number.isFinite(Date.parse(sun.sunrise))).toBe(true);
  }, 30_000);

  it("NOAA SWPC Kp still parses", async () => {
    const spaceWeather = await fetchSpaceWeather();
    expect(typeof spaceWeather.kpIndex).toBe("number");
  }, 30_000);

  it("adsbdb resolves a known airline callsign", async () => {
    const route = await fetchFlightRoute("BAW123");
    expect(route).not.toBeNull();
    expect(typeof route?.origin.latitude).toBe("number");
  }, 30_000);

  it("Wikipedia + Open-Meteo archive still back place info", async () => {
    const info = await fetchPlaceInfo("Paris", PARIS.lat, PARIS.lon);
    expect(info.summary).toBeTruthy();
    expect(typeof info.averageTempC).toBe("number");
  }, 60_000);
});
