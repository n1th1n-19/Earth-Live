# 5. API Integration Guide

This is the authoritative data-sourcing reference for Earth Live. Every layer and panel in [02-product-requirements.md](02-product-requirements.md) traces to one of the sources below. Where no free, truly live source exists, that is stated explicitly, with the closest free alternative and its caveats — per the product's non-negotiable "no mock data" constraint.

**Conventions used below:**
- **Auth** — how the credential is obtained/sent.
- **Rate limit** — the documented free-tier ceiling.
- **Refresh interval** — how often Earth Live polls it (chosen to match how often the underlying data actually changes, never faster).
- **Cache TTL** — the server-side Redis TTL applied (see [03-architecture.md](03-architecture.md) §3.5), always ≥ refresh interval.
- **Attribution** — text/link Earth Live must display, if the license requires it.

---

## 5.1 Weather

### Open-Meteo (primary)
- **What:** Hourly/current forecast, temperature, wind, precipitation, snow, pressure, humidity, cloud cover, visibility, UV index — the backbone of the Weather layer category.
- **Endpoint:** `https://api.open-meteo.com/v1/forecast` (current + forecast); `https://api.open-meteo.com/v1/dwd-icon`, `/gfs`, etc. for model-specific variants; historical via `https://archive-api.open-meteo.com/v1/archive`.
- **Auth:** None for non-commercial use under Open-Meteo's free-access policy; an API key is only needed if traffic exceeds the free daily-call threshold, at which point a low-cost commercial tier applies — flagged in [08-deployment-guide.md](08-deployment-guide.md) as a scaling trigger to monitor, not a v1 requirement.
- **Rate limit:** Documented free/non-commercial fair-use ceiling (order of 10,000 calls/day per IP); Earth Live's server-side cache-aside pattern means actual upstream call volume is decoupled from end-user traffic, keeping this well under the ceiling.
- **Response format:** JSON.
- **Refresh interval:** Hourly model data — poll every 15–20 minutes (safely inside how often the model itself updates) rather than every hour, to catch the model's own refresh promptly.
- **Cache TTL:** 15 minutes.
- **Attribution:** "Weather data by Open-Meteo.com" (CC BY 4.0) displayed in the app's data-sources/credits panel.
- **Docs:** open-meteo.com/en/docs
- **Reliability:** High; European-hosted, no key friction. Primary source for all weather sub-layers except US radar.
- **Alternative:** Meteostat (below) for historical/climate comparisons; NWS (below) for US-specific point forecasts and radar.

### National Weather Service (NWS / api.weather.gov)
- **What:** US point forecasts, alerts, and composite radar imagery.
- **Endpoint:** `https://api.weather.gov/points/{lat},{lon}` (resolves to a forecast office + grid, which then links to `/gridpoints/{office}/{x},{y}/forecast`); alerts at `https://api.weather.gov/alerts/active?point={lat},{lon}`.
- **Auth:** None required, but a descriptive `User-Agent` header (app name + contact email) is mandatory per NWS policy.
- **Rate limit:** No hard published cap; NWS asks for "reasonable" use and to cache aggressively — Earth Live's cache-aside layer satisfies this directly.
- **Response format:** GeoJSON.
- **Refresh interval:** 10 minutes for alerts (these are time-sensitive), hourly for forecast grids.
- **Cache TTL:** 10 min (alerts) / 60 min (forecast).
- **Attribution:** Public domain (US government work) — no attribution legally required, but "Data: National Weather Service" is shown for transparency.
- **Docs:** weather.gov/documentation/services-web-api
- **Reliability:** High but US-only; used to augment Open-Meteo with official US alerts/warnings text.
- **Alternative/scope note:** For non-US alerts, no single free global severe-weather-alert API exists at NWS's fidelity; GDACS (§5.4) is the closest global multi-hazard alert alternative.

### NOAA (radar & space weather — see also §5.9)
- **What:** Composite reflectivity radar imagery (US) via NOAA's public radar tile/WMS services (e.g., through the National Weather Service's `nowCOAST` mapping services), used for the Radar layer.
- **Endpoint:** `nowcoast.noaa.gov` WMS/WMTS endpoints (public, no key).
- **Auth:** None.
- **Rate limit:** No published hard cap; treated as a tile server and cached/proxied like any map tile.
- **Refresh interval:** ~5–10 minutes (matches NEXRAD sweep cadence).
- **Cache TTL:** 5 minutes.
- **Attribution:** "Radar: NOAA/National Weather Service."
- **Reliability:** High, US-only. Outside the US, Open-Meteo's precipitation/radar-equivalent model layer is the fallback (explicitly labeled as model-derived, not raw radar, where NEXRAD coverage doesn't exist).

### Meteostat
- **What:** Historical/climate point data (station observations, normals) for weather comparison and replay-mode historical context.
- **Endpoint:** Meteostat's free bulk data (CSV, `bulk.meteostat.net`) for offline ingestion, or the RapidAPI-hosted Meteostat endpoint for on-demand queries at a limited free tier.
- **Auth:** RapidAPI key (free tier) for the on-demand API; no key for the bulk CSV downloads.
- **Rate limit:** RapidAPI free tier is limited (low hundreds of calls/month) — Earth Live therefore prefers the **bulk CSV ingestion** path into Postgres for historical/comparison features rather than live-querying Meteostat per request.
- **Refresh interval:** Not applicable (historical data); bulk data refreshed via a periodic background job (weekly).
- **Attribution:** "Historical data: Meteostat" (CC BY-NC 4.0 — non-commercial; flagged for legal review before any monetization of features built on it).
- **Docs:** dev.meteostat.net
- **Reliability:** Good for historical use case; not used for any "live" claim.

---

## 5.2 Environment (air quality)

### Open-Meteo Air Quality API (primary)
- **Endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality`
- **Auth:** None (same free policy as core Open-Meteo).
- **Rate limit:** Same fair-use tier as §5.1.
- **Response format:** JSON — European AQI and US AQI, PM2.5, PM10, O₃, NO₂, SO₂, CO.
- **Refresh interval:** Hourly.
- **Cache TTL:** 20 minutes.
- **Attribution:** "Air quality data by Open-Meteo.com."
- **Reliability:** High, global coverage via CAMS model data (Copernicus Atmosphere Monitoring Service, redistributed through Open-Meteo).

### OpenAQ (secondary / station-level ground truth)
- **What:** Real, ground-station-measured air quality (as opposed to Open-Meteo's model-derived values) — used to enrich the local AQI panel with "nearest physical monitoring station" readings where available.
- **Endpoint:** `https://api.openaq.org/v3/locations` (nearby stations), `https://api.openaq.org/v3/measurements` (readings).
- **Auth:** Free API key (`X-API-Key` header), obtained via self-serve registration at explore.openaq.org.
- **Rate limit:** Free tier: 60 requests/minute, 2,000 requests/day (per OpenAQ's published v3 limits).
- **Response format:** JSON.
- **Refresh interval:** 30–60 minutes (station reporting cadence varies by network).
- **Cache TTL:** 30 minutes.
- **Attribution:** "Air quality station data: OpenAQ" (CC BY 4.0), with per-station source-network credit where OpenAQ's response includes it (many stations are themselves government-network passthroughs).
- **Docs:** docs.openaq.org
- **Reliability:** Coverage is uneven (dense in some countries, sparse in others) — Earth Live always falls back to the Open-Meteo model value when no nearby station exists within a configurable radius, and labels which of the two sources is showing.

### Copernicus (CAMS / Climate Data Store)
- **What:** Underlying source of the atmospheric composition model data that powers both Open-Meteo's air-quality product and, more broadly, European environmental datasets.
- **Access:** Free registration at the Copernicus Climate Data Store (`cds.climate.copernicus.eu`) via the `cdsapi` Python client and an API key tied to the account.
- **Rate limit:** Request-queue-based (not a simple per-minute cap) — large data-file downloads, not a low-latency REST API, so **not used for live requests**; noted here as the authoritative upstream of the model data Earth Live consumes indirectly through Open-Meteo, and as a future direct-integration option for advanced/experimental layers.
- **Reliability:** Authoritative but batch-oriented; direct integration deferred to a later roadmap phase (see [11-roadmap.md](11-roadmap.md)).

### NASA EarthData
- **What:** Broad umbrella of NASA Earth-observation datasets (used indirectly for FIRMS wildfire data, §5.3, and as the source of night-lights imagery, §5.7).
- **Access:** Free Earthdata Login account (`urs.earthdata.nasa.gov`) required for most direct dataset downloads.
- **Rate limit:** Varies by dataset/DAAC; not used for low-latency live requests — Earth Live consumes NASA data through the purpose-built real-time APIs below (FIRMS, DONKI, EPIC) rather than raw EarthData downloads, except for the periodic night-lights composite ingestion job.

---

## 5.3 Geological hazards

### USGS Earthquake Hazards Program (primary — Earthquakes layer)
- **Endpoint:** GeoJSON summary feeds, e.g. `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`, with `all_day`, `all_week`, `all_month`, and magnitude-filtered variants (`2.5_day`, `4.5_week`, `significant_month`, etc.) at the same path pattern. A full query API also exists at `https://earthquake.usgs.gov/fdsnws/event/1/query` for custom radius/magnitude/time-range queries (used for the "nearby earthquakes" and Replay features).
- **Auth:** None.
- **Rate limit:** No published hard limit; USGS explicitly designs these as public feeds, but publishes a "don't hammer it" fair-use expectation — satisfied by Earth Live's cache-aside layer (one upstream poll per cache TTL, regardless of end-user count).
- **Response format:** GeoJSON.
- **Refresh interval:** The `all_hour`/`all_day` summary feeds themselves update every minute; Earth Live polls every 60 seconds for the live layer.
- **Cache TTL:** 60 seconds.
- **Attribution:** Public domain (US government work); "Data: USGS Earthquake Hazards Program" shown for transparency and to link to the authoritative per-event USGS page (FR-17).
- **Docs:** earthquake.usgs.gov/earthquakes/feed
- **Reliability:** Very high — this is the global reference source and is used as-is with no fallback needed.

### Smithsonian Global Volcanism Program (Volcanoes layer)
- **What:** Holocene volcano database and weekly activity reports.
- **Endpoint:** No formal low-latency REST API; data is published as a downloadable database (volcano.si.edu) and the joint **USGS/Smithsonian Weekly Volcanic Activity Report**. The USGS Volcano Hazards Program also publishes its own current US volcano alert-level feed at `https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes` (US volcanoes only, JSON, no key).
- **Auth:** None for either source.
- **Rate limit:** N/A (periodic bulk data, not a polled live API).
- **Refresh interval / liveness:** **Explicitly periodic, not live.** The volcano database itself changes rarely (new named volcanoes are added infrequently); the *activity status* updates weekly via the GVP/USGS joint report. Earth Live's Volcanoes layer is labeled "Periodic — updated weekly" in the UI per FR-15, ingested by a weekly background job rather than polled per request.
- **Cache TTL:** 7 days (re-ingestion job cadence).
- **Attribution:** "Volcano data: Smithsonian Institution Global Volcanism Program; US alert levels: USGS Volcano Hazards Program."
- **Docs:** volcano.si.edu/gvp_votw.cfm ; volcanoes.usgs.gov
- **Reliability:** High as a reference dataset; correctly scoped in-product as non-real-time.

### NASA FIRMS (Fire Information for Resource Management System — Wildfires layer)
- **Endpoint:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{source}/{area}/{dayRange}` (also available as JSON); `source` selects the satellite sensor (`VIIRS_SNPP_NRT`, `MODIS_NRT`, `VIIRS_NOAA20_NRT`, etc.).
- **Auth:** Free `MAP_KEY`, obtained via self-serve registration at firms.modaps.eosdis.nasa.gov/api/map_key.
- **Rate limit:** 5,000 transactions per 10-minute window per key (published FIRMS limit) — comfortably sufficient given Earth Live polls once per cache TTL, not per user.
- **Response format:** CSV or JSON — each row is a detected fire "hotspot" with lat/lon, brightness, confidence, satellite/instrument, and detection time.
- **Refresh interval:** Satellite-pass-limited — VIIRS/MODIS revisit a given point roughly every few hours; Earth Live polls every 3 hours, matching the "NRT" (near-real-time) product's actual update cadence, and is explicit in the UI that this is satellite-pass-based, not continuous.
- **Cache TTL:** 3 hours.
- **Attribution:** "Active fire data courtesy of NASA FIRMS" (required attribution per FIRMS terms of use), with a link to the FIRMS disclaimer that detections are not confirmed wildfires (thermal anomalies can include agricultural burning, gas flares, etc.) — surfaced in the event detail panel (FR-17) so users get accurate context, not an overclaim.
- **Docs:** firms.modaps.eosdis.nasa.gov/api
- **Reliability:** High; the standard global source for satellite-detected active fire/thermal-anomaly data.

### GDACS (Global Disaster Alert and Coordination System — supplementary multi-hazard)
- **What:** Aggregated alerts for earthquakes, tropical cyclones, floods, volcanoes, and droughts with a severity score — used as a cross-check/enrichment source, not a primary layer.
- **Endpoint:** `https://www.gdacs.org/xml/rss.xml` (RSS/GeoRSS) and a JSON events API at `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH`.
- **Auth:** None.
- **Rate limit:** No published hard cap; fair-use, cached per standard pattern.
- **Refresh interval:** 15–30 minutes.
- **Attribution:** "Alerts: GDACS (Global Disaster Alert and Coordination System)."
- **Reliability:** Good as a supplementary global multi-hazard cross-reference; USGS/FIRMS remain primary for their respective domains.

---

## 5.4 Space & satellites

### Open Notify (ISS position)
- **Endpoint:** `http://api.open-notify.org/iss-now.json` (current ISS lat/lon), `http://api.open-notify.org/astros.json` (people currently in space).
- **Auth:** None.
- **Rate limit:** Unpublished/informal; low-overhead endpoint, polled at a safe interval regardless.
- **Refresh interval:** Every 5–10 seconds when the ISS marker/panel is actively in view (this is the one layer polled near-continuously, since orbital motion is fast — ISS covers ~7.7 km/s).
- **Reliability caveat:** Open Notify is a community-run, best-effort service with occasional downtime. **Fallback:** compute ISS (and any other tracked satellite's) position client-side from CelesTrak TLE data (below) using standard SGP4 orbital propagation — this is the more robust production path and is used as the primary method, with Open Notify's live endpoint as a periodic cross-check/simplicity option for the MVP.
- **Attribution:** None legally required; "ISS tracking: Open Notify / CelesTrak" credited for transparency.
- **Docs:** open-notify.org

### CelesTrak (satellite catalog — Satellites layer & ISS propagation)
- **What:** Publishes current NORAD two-line element sets (TLEs) for tracked objects (ISS, Starlink, weather/comms satellites, debris).
- **Endpoint:** `https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json` (e.g., `GROUP=stations` for ISS/space stations, `GROUP=active` for all active satellites, `GROUP=weather`, etc.).
- **Auth:** None.
- **Rate limit:** No published hard cap; CelesTrak asks that automated systems not poll more than a few times per day since TLEs themselves are only updated once or twice daily per object — Earth Live's ingestion job pulls the relevant groups once every 6–12 hours and caches the propagation inputs, then computes live positions **client-side** (or in a lightweight worker) via SGP4 using those cached elements, which is the correct way to get "live" motion without re-polling CelesTrak continuously.
- **Response format:** JSON, XML, or classic TLE text.
- **Attribution:** "Orbital data: CelesTrak (Dr. T.S. Kelso)" — requested by CelesTrak's usage terms.
- **Docs:** celestrak.org/NORAD/documentation
- **Reliability:** The de facto standard free TLE source; very high reliability.

### NASA APIs (api.nasa.gov)
- **What:** A collection of NASA endpoints behind one shared key: **DONKI** (space weather events — solar flares, CMEs, geomagnetic storms), **EPIC** (daily full-disk Earth imagery from the DSCOVR satellite), **APOD** (Astronomy Picture of the Day, used only for an optional "space" info panel, not a core layer), **NeoWs** (near-Earth asteroid tracking).
- **Endpoint base:** `https://api.nasa.gov/DONKI/...`, `https://api.nasa.gov/EPIC/api/natural/images`, `https://api.nasa.gov/planetary/apod`, `https://api.nasa.gov/neo/rest/v1/feed`.
- **Auth:** Free API key via self-serve signup at api.nasa.gov; a shared `DEMO_KEY` exists for evaluation only.
- **Rate limit:** Registered free key: 1,000 requests/hour. `DEMO_KEY`: 30 requests/hour, 50/day — Earth Live uses a registered key from day one given the low ceiling of `DEMO_KEY`.
- **Refresh interval:** DONKI space-weather events, hourly; EPIC full-disk imagery, once per available daily pass (used for an optional "Earth from space today" view, not the primary globe imagery).
- **Attribution:** "Space weather & imagery: NASA."
- **Docs:** api.nasa.gov
- **Reliability:** High; official NASA-hosted gateway.

### ESA (European Space Agency)
- **What:** Considered for near-Earth-object and space-situational-awareness enrichment (ESA's Space Debris Office / NEOCC publish data), but ESA does not offer a single unified free low-latency public REST API comparable to NASA's; most ESA data access is portal/download-based (e.g., ESA's Space Situational Awareness data portal requires an approved account for some products).
- **Decision:** Not used as a live v1 data source. Flagged as a future integration if a specific ESA open dataset with a stable REST endpoint (e.g., select Copernicus Sentinel imagery products, which are free but bandwidth-heavy) becomes relevant to a later imagery-quality roadmap item.

---

## 5.5 Maps, geocoding, and reference data

### OpenStreetMap (base vector data)
- **What:** Source of roads, borders (via boundary relations), and building footprints for the 3D buildings layer.
- **Access:** Raw data via the OSM API (`api.openstreetmap.org`, editing-focused, not for bulk read) or, for a production tile pipeline, pre-rendered/extracted data via a vector tile provider. Earth Live self-hosts a vector tile pipeline (e.g., using open-source tools such as Planetiler/Tilemaker against OSM planet/regional extracts) rather than depending on any single third party's tile-serving free tier at scale.
- **License:** Open Database License (ODbL) — requires attribution ("© OpenStreetMap contributors") and share-alike on the *data*, which self-hosted tile generation satisfies cleanly.
- **Refresh interval:** OSM data itself changes continuously; Earth Live's self-hosted tile pipeline re-syncs from OSM diffs on a weekly-to-daily cadence — roads/borders/buildings are correctly labeled "Static" (periodically refreshed reference data) in the UI, not "Live," since they aren't event data.
- **Docs:** wiki.openstreetmap.org/wiki/API ; wiki.openstreetmap.org/wiki/Planet.osm

### Nominatim (geocoding — Search feature)
- **Endpoint:** `https://nominatim.openstreetmap.org/search?q={query}&format=json` (forward geocoding), `/reverse` (reverse geocoding).
- **Auth:** None, but a valid `User-Agent`/`Referer` is required.
- **Rate limit:** The public OSM-hosted instance enforces **1 request/second** and explicitly asks bulk/production users to self-host. **Decision:** Earth Live proxies all geocoding requests through its own backend, applies request coalescing/caching (identical queries within a TTL are never re-sent), and stays within the 1 req/s ceiling at low scale; the architecture document flags self-hosting Nominatim (or switching to a higher-throughput provider such as MapTiler's or Geoapify's free-tier geocoding) as the first scaling change once traffic approaches that ceiling.
- **Response format:** JSON.
- **Cache TTL:** 24 hours (place-name-to-coordinate mappings are effectively static).
- **Attribution:** "Search: © OpenStreetMap contributors (Nominatim)."
- **Docs:** nominatim.org/release-docs/latest/api/Overview

### MapLibre GL JS
- Rendering library, not a data API — see [03-architecture.md](03-architecture.md) §3.2 and [07-tech-stack.md](07-tech-stack.md). No usage limits since it's a self-hosted, license-free (BSD-3) client library; the *tiles* it renders (from the self-hosted OSM pipeline above) are the actual network resource governed by the OSM/self-hosting terms.

### Natural Earth
- **What:** Public-domain vector/raster reference datasets (coastlines, admin-0/1 boundaries at multiple simplification levels, populated places) — used for low-zoom border rendering where full OSM boundary-relation fidelity is unnecessary and a lighter, pre-simplified dataset renders faster.
- **Access:** Direct bulk download (naturalearthdata.com), no API, no key, public domain (no attribution legally required, though credited in the data-sources panel).
- **Refresh interval:** Static; re-downloaded only on Natural Earth's own infrequent version releases.

### GeoNames
- **What:** Place-name gazetteer and, notably, a free timezone-lookup-by-coordinate endpoint (used for the local timezone panel, FR-7).
- **Endpoint:** `http://api.geonames.org/timezoneJSON?lat={lat}&lng={lon}&username={user}`; also `searchJSON` for place search as a Nominatim complement/fallback.
- **Auth:** Free username registration at geonames.org.
- **Rate limit:** Free tier: 1,000 credits/hour, 20,000/day (published GeoNames limit; a "credit" ≈ one request for most endpoints).
- **Response format:** JSON.
- **Cache TTL:** 24 hours for timezone-by-coordinate (timezone boundaries don't move).
- **Attribution:** "Timezone data: GeoNames" (CC BY 4.0).
- **Docs:** geonames.org/export/web-services.html

### REST Countries
- **What:** Static country metadata (flags, capital, population figure, currency, calling code) shown when a user's camera is centered within a country's borders, or in the country-info portion of a location detail panel.
- **Endpoint:** `https://restcountries.com/v3.1/name/{name}`, `/alpha/{code}`, `/all`.
- **Auth:** None.
- **Rate limit:** No published hard cap for reasonable use.
- **Response format:** JSON.
- **Refresh interval:** Static reference data; cached indefinitely with periodic (monthly) re-sync.
- **Attribution:** None required; credited for transparency.
- **Docs:** restcountries.com

### Wikidata
- **What:** Supplementary structured facts (e.g., a landmark's Wikidata entity for richer place-detail panels) via SPARQL.
- **Endpoint:** `https://query.wikidata.org/sparql`.
- **Auth:** None.
- **Rate limit:** Shared public endpoint; fair-use, aggressively cached, used only for optional enrichment (not on the critical path of any core layer).
- **License:** CC0 (public domain).
- **Docs:** query.wikidata.org

---

## 5.6 Flights & airports

### OpenSky Network (primary — Flights layer)
- **Endpoint:** `https://opensky-network.org/api/states/all` (all current states, optionally bounded by a `lamin,lomin,lamax,lomax` bounding box for the visible viewport).
- **Auth:** Anonymous access works unauthenticated; a free registered account (OAuth2 client credentials) raises the quota substantially.
- **Rate limit:** Anonymous: roughly 400 API credits/day with ~10-second effective resolution; registered free account: roughly 4,000 credits/day with better resolution. Earth Live uses a **registered account** and the SSE fan-out pattern (§3.3/3.4) so the credit cost is paid once centrally regardless of concurrent Earth Live users.
- **Response format:** JSON (array of state vectors: ICAO24, callsign, origin country, position, altitude, velocity, heading, vertical rate, on-ground flag).
- **Refresh interval:** Every 10–15 seconds for the live layer (matching OpenSky's own update resolution).
- **Cache TTL:** 10 seconds (short — this is the app's most time-sensitive polled layer besides ISS).
- **Attribution:** "Flight data: OpenSky Network" (required by OpenSky's terms of use).
- **Docs:** opensky-network.org/apidoc
- **Reliability:** Good; community/academic-operated, occasional brief gaps — treated as a "live, best-effort" source, consistent with FlightRadar24-style products that also rely on ADS-B crowdsourced coverage (which is inherently uneven over oceans and some regions).

### OurAirports (Airports reference layer)
- **What:** Static database of airports worldwide (IATA/ICAO codes, coordinates, elevation, runway data) — used to render airport markers and resolve airport-code search queries (FR-11).
- **Access:** Free bulk CSV downloads (`ourairports.com/data/airports.csv`, `runways.csv`), public domain.
- **Auth:** None.
- **Refresh interval:** Static; re-downloaded via a monthly background ingestion job.
- **Attribution:** None legally required (public domain); credited for transparency.
- **Docs:** ourairports.com/data

---

## 5.7 Marine, ocean, and ships

### NOAA National Data Buoy Center (NDBC — Ocean buoys layer)
- **Endpoint:** Per-station real-time text reports at `https://www.ndbc.noaa.gov/data/realtime2/{station_id}.txt`, and a station catalog at `https://www.ndbc.noaa.gov/activestations.xml`.
- **Auth:** None.
- **Rate limit:** No published hard cap; plain-text file fetches, cached like any static-ish resource.
- **Response format:** Fixed-width text (parsed server-side into structured JSON before reaching the client).
- **Refresh interval:** Buoys typically report hourly; Earth Live polls each relevant station every 60 minutes.
- **Cache TTL:** 60 minutes.
- **Attribution:** "Ocean buoy data: NOAA National Data Buoy Center."
- **Docs:** ndbc.noaa.gov/docs

### NOAA CO-OPS (Tides & Currents)
- **Endpoint:** `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` — water level, tide predictions, currents at US coastal stations.
- **Auth:** None.
- **Rate limit:** No published hard cap for reasonable use.
- **Refresh interval:** 6 minutes (matches station reporting cadence) for observed data; tide predictions are computed/static per station.
- **Attribution:** "Tides & currents: NOAA CO-OPS."
- **Docs:** api.tidesandcurrents.noaa.gov/api/prod

### NOAA National Hurricane Center (NHC — Cyclones layer)
- **Endpoint:** Active-storm GeoJSON/KML/Shapefile feeds published at `nhc.noaa.gov/gis/` (e.g., current storm positions, forecast cones, and track lines as GeoJSON).
- **Auth:** None.
- **Rate limit:** No published hard cap; standard fair-use caching applies.
- **Refresh interval:** Every 15–30 minutes during an active advisory cycle (NHC issues updates on a fixed schedule, roughly every 6 hours for full advisories with more frequent intermediate updates during landfall threats).
- **Attribution:** "Tropical cyclone data: NOAA National Hurricane Center."
- **Docs:** nhc.noaa.gov/gis
- **Scope note:** NHC covers the Atlantic and Eastern/Central Pacific basins; for global cyclone coverage (e.g., Western Pacific typhoons, Indian Ocean cyclones), the Joint Typhoon Warning Center (JTWC) publishes comparable free public bulletins/GIS data used as a supplementary source for full global coverage.

### Copernicus Marine Service (CMEMS)
- **What:** Sea-surface temperature, currents, and wave-height model/satellite products at global scale — a deeper alternative/supplement to NDBC's point-station data.
- **Access:** Free registration at marine.copernicus.eu; data retrieved via their Python toolbox/API against large gridded NetCDF products.
- **Rate limit:** Not a low-latency REST API — batch/subset downloads. **Not used for live per-request calls**; reserved for a periodic (e.g., daily) ingestion job that pre-computes a lightweight global SST/wave overlay layer, distinct from the live point-buoy readings above.
- **Reliability:** Authoritative, but batch-oriented — labeled "Periodic" in the layer panel, consistent with FR-15.

### Ships / marine (AIS) traffic — explicit gap
- **No free API provides FlightRadar24-equivalent live global AIS ship tracking.** Commercial AIS aggregators (MarineTraffic, VesselFinder, Spire) gate real-time global coverage behind paid plans.
- **Closest free alternative: AISHub.** AISHub provides free API access to its aggregated AIS feed, but **only to members who themselves contribute an AIS receiver feed** (a reciprocal community-sharing model) — meaning it is not a no-strings-attached free API for a typical web app; it requires either running a physical AIS receiver or partnering with an existing contributing station.
- **Product decision:** The Ships layer ships in v1 as **best-effort, and only if a specific AISHub sharing arrangement is secured before launch**; if not secured, the layer is either omitted from v1 or, if included, explicitly labeled "Coverage: partial, community-contributed" rather than implying FlightRadar24-equivalent completeness. This is called out here so the engineering team does not assume live-global-AIS is a solved problem the way live-global-flights (OpenSky) is.
- **Docs:** aishub.net/api

---

## 5.8 Time, sun, and moon

### Local timezone
- Resolved via **GeoNames** `timezoneJSON` (§5.5) server-side, and cross-checked client-side against the browser's own `Intl.DateTimeFormat().resolvedOptions().timeZone` when the coordinate is the user's own device location (free, zero-API-call, built into every browser) — the client-side `Intl` API is the preferred zero-cost path whenever the coordinate in question *is* the user's own device, with GeoNames used for arbitrary map locations the user has panned to.

### Sunrise-Sunset.org (Sunrise/sunset times)
- **Endpoint:** `https://api.sunrise-sunset.org/json?lat={lat}&lng={lon}&formatted=0`.
- **Auth:** None.
- **Rate limit:** No hard published cap; the service asks for reasonable use — cached per-location per-day (sunrise/sunset for a given coordinate and date is fully deterministic and doesn't need re-fetching intraday).
- **Response format:** JSON.
- **Cache TTL:** 24 hours.
- **Attribution:** None strictly required; credited for transparency.
- **Docs:** sunrise-sunset.org/api

### Moon phase — explicit no-free-API note, algorithmic alternative
- **No widely free, no-key, unlimited moon-phase REST API exists** at production scale (several "astronomy" APIs — e.g., ipgeolocation.io's astronomy endpoint — offer moon phase but only within a limited free-request quota shared across all astronomy features, which is fragile for a core panel shown to every localized user).
- **Chosen approach: client-side algorithmic computation.** Moon phase, illumination percentage, and moonrise/moonset are fully deterministic from date/time and coordinates and can be computed with a small, well-established open-source astronomy formula set (e.g., the algorithms popularized by the MIT-licensed `SunCalc.js` library) — **zero API calls, zero rate limit, zero cost, and genuinely real-time** (recomputed instantly for any date/time client-side). This is explicitly the recommended free alternative per the product's own instructions: when no free live API exists, prefer a correct client-side computation over a rate-limited or paid API.
- **Docs/reference:** the public-domain astronomical algorithms in Jean Meeus's *Astronomical Algorithms*, as implemented in open-source libraries such as SunCalc.

---

## 5.9 Elevation & terrain

### Open-Meteo Elevation API (point elevation — used for the local "elevation" stat, FR-7)
- **Endpoint:** `https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}`.
- **Auth:** None (same free policy as §5.1).
- **Rate limit:** Same fair-use tier as core Open-Meteo.
- **Response format:** JSON.
- **Cache TTL:** Effectively permanent per coordinate (elevation doesn't change) — cached indefinitely, keyed by rounded coordinate.
- **Reliability:** High; preferred over OpenTopoData for the single-point "your elevation" stat specifically because it shares Earth Live's already-integrated Open-Meteo client and free policy.

### OpenTopoData (bulk/alternative elevation, SRTM)
- **Endpoint:** The public demo instance at `https://api.opentopodata.org/v1/srtm90m?locations={lat},{lon}`.
- **Auth:** None.
- **Rate limit:** The **public demo server is explicitly rate-limited** (documented as roughly 1 request/second and ~1,000 requests/day per IP) and OpenTopoData's own docs recommend self-hosting (it's open-source and Docker-deployable with downloadable SRTM/other DEM datasets) for any production use beyond light testing.
- **Product decision:** Used only as a lightweight fallback/spot-check; Open-Meteo's Elevation API is primary for the live product given its higher-headroom free policy, with a **self-hosted OpenTopoData instance** flagged as the correct scaling path if bulk/batch elevation lookups (e.g., for the measurement tool's elevation profile feature) exceed what's comfortable against the public demo server.
- **Docs:** opentopodata.org

### Terrain rendering (3D globe relief — distinct from the point-elevation stat above)
- **Cesium World Terrain** via a free **Cesium ion** account — global quantized-mesh terrain streamed directly into the CesiumJS globe (see [03-architecture.md](03-architecture.md) §3.2.4). Cesium ion's free tier includes a monthly streaming allowance sufficient for v1 traffic; this is the terrain data actually rendered under the camera, distinct from and complementary to the Open-Meteo point-elevation number shown in a text panel.
- **Fully free/open alternative (no Cesium ion dependency):** global DEM tiles derived from **Copernicus GLO-30 DEM** (ESA/Copernicus, public and free, ~30m global resolution) or NASA SRTM, self-processed into quantized-mesh or terrain-RGB tiles and self-hosted — documented here as the path to a zero-vendor-dependency terrain pipeline if the Cesium ion free tier's streaming allowance ever becomes a constraint at scale.
- **Docs:** cesium.com/platform/cesium-ion ; opentopography.org (Copernicus/SRTM DEM access)

---

## 5.10 Space weather (aurora & solar activity)

### NOAA Space Weather Prediction Center (SWPC)
- **What:** Aurora (Ovation model) forecast, solar wind parameters, planetary Kp index, X-ray flux (flare activity) — powers the Aurora forecast and Solar wind/Kp layers.
- **Endpoints (all free, no key, JSON):**
  - `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json` — aurora probability grid.
  - `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` — Kp index.
  - `https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json` and `mag-2-hour.json` — real-time solar wind.
  - `https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json` — X-ray flux/flare activity.
- **Auth:** None.
- **Rate limit:** No published hard cap; standard fair-use, cached per Earth Live's normal pattern.
- **Refresh interval:** Aurora/Ovation: 30–60 minutes (matches model update cadence); Kp index and solar wind: 1–5 minutes (near-real-time telemetry).
- **Cache TTL:** 5 minutes (solar wind/Kp), 30 minutes (aurora forecast).
- **Attribution:** "Space weather data: NOAA Space Weather Prediction Center."
- **Docs:** swpc.noaa.gov/products-and-data
- **Reliability:** Very high; the authoritative US government source for this domain, also cross-published via NASA's DONKI (§5.4) for event-level (CME/flare) summaries.

---

## 5.11 Reference layers with no live equivalent (explicit call-outs)

Per the product constraint that any feature without a free live-data option must be stated explicitly:

| Feature | Live data available? | Chosen free alternative | Labeling in UI |
|---|---|---|---|
| Lightning strikes | No free, complete, low-latency global lightning API exists (commercial networks like Vaisala/Earth Networks are paid). | **Blitzortung.org** community lightning-detection network publishes near-real-time strike data via a community WebSocket feed; access is informally shared (no official stable public REST API/ToS in the way FIRMS or USGS provide) and coverage/uptime is best-effort, contributor-network-dependent. | "Lightning — best-effort, community network (Blitzortung), coverage varies by region" |
| Ships / AIS | No free *global, complete* live AIS API. | AISHub, reciprocal-sharing model only (§5.7). | "Ships — partial coverage, community-contributed" or omitted if no sharing arrangement is secured |
| Moon phase | No free unlimited low-friction API at this call volume. | Client-side algorithmic computation (SunCalc-style formulas) — genuinely accurate and real-time, just not "API-sourced." | Not labeled as a limitation in the UI — this alternative is fully equivalent in correctness to an API, it's simply computed rather than fetched. |
| Night lights imagery | Not live — city lights don't meaningfully change minute-to-minute, and no provider publishes a continuously-updated global composite. | **NASA Black Marble** (VIIRS Day/Night Band annual/monthly composite, free via NASA EarthData) as a static/periodic imagery layer. | "Night Lights — static composite, periodically updated" |
| Population density | Not live — population is inherently a slow-changing, periodically-surveyed statistic. | A free published gridded population dataset (e.g., WorldPop or the Gridded Population of the World (GPW) series, both free for research/most use) ingested as a static overlay. | "Population — static dataset, periodic updates" |
| 3D buildings | Footprints are static (buildings don't move); "live" isn't a meaningful concept here. | OSM building footprints extruded via 3D Tiles (§5.5). | "Reference layer" (no liveness badge needed — inherently static category) |

This table exists specifically so no engineer or stakeholder mistakes these six layers for continuously-live feeds — they are correctly-labeled, honestly-sourced, but not "live" in the sense the rest of the product is.

---

## 5.12 Cross-cutting caching summary

| Data domain | Refresh interval | Cache TTL | Why this cadence |
|---|---|---|---|
| ISS position | 5–10s | 5–10s | Fast orbital motion |
| Flights (OpenSky) | 10–15s | 10s | Matches OpenSky's own resolution |
| Earthquakes (USGS) | 60s | 60s | Matches USGS summary feed update cadence |
| Solar wind / Kp | 1–5 min | 5 min | Real-time space weather telemetry |
| Weather (Open-Meteo) | 15–20 min | 15 min | Hourly model, polled sub-hourly to catch refresh promptly |
| Radar (NOAA) | 5–10 min | 5 min | NEXRAD sweep cadence |
| Air quality | 20–60 min | 20–30 min | Hourly model / station cadence |
| Ocean buoys / tides | 6–60 min | 60 min | Station reporting cadence |
| Aurora forecast | 30–60 min | 30 min | Ovation model cadence |
| Wildfires (FIRMS) | 3 hr | 3 hr | Satellite revisit cadence |
| Cyclone tracks | 15–30 min | 15 min | NHC advisory update cadence |
| Volcano status | 7 days | 7 days | GVP/USGS weekly report |
| Geocoding results | 24 hr | 24 hr | Place-to-coordinate mapping is static |
| Elevation, timezone | Effectively permanent | Permanent (keyed by rounded coordinate) | Physically static values |
| Borders, roads, buildings, population, night lights | Days–weeks | Days–weeks | Reference datasets with slow ground-truth change |
