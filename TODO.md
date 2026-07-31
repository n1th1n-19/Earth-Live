# Earth Live — V1 Build TODO

Derived from [docs/](docs/00-README.md). Ordered roughly by dependency — later phases assume earlier ones are functional. Check off as completed.

Auth is explicitly out of scope per product decision — every Phase 1 auth item below is marked accordingly, not "blocked."

## Phase 0 — Project setup

- [x] Init Next.js (App Router, TypeScript) repo; init git; pushed to `github.com/n1th1n-19/Earth-Live`
- [x] Neon (Postgres + PostGIS) and Upstash Redis — both provisioned with real credentials, migration applied
- [x] Configure ESLint/TypeScript strict mode — [07-tech-stack.md](docs/07-tech-stack.md) §7.3 *(custom no-client-keyed-fetch lint rule still not written — a real gap, not just untested)*
- [x] GitHub Actions CI (lint, typecheck, unit tests, build) — `.github/workflows/ci.yml`
- [x] FIRMS, NASA, OpenAQ, GeoNames, Cesium ion, Sentry — all registered, real keys in `.env`, live-verified
- [x] Sentry (frontend + backend) — installed via the official setup wizard, source maps upload in CI/build

## Phase 1 — Database & auth

- [x] Prisma schema for all tables in [06-database-design.md](docs/06-database-design.md)
- [x] PostGIS enabled, geography columns present
- [x] **Real Neon database provisioned, first migration applied** (`20260725164335_init`) — tables and PostGIS extension live
- [ ] ~~Auth.js~~ — **out of scope by product decision, not implemented**
- [x] Confirm anonymous usage works end-to-end with no auth required — the entire app, including every feature added this session, works with zero auth

## Phase 2 — BFF / adapter layer

- [x] Generic adapter pattern (fetch → normalize → Zod-validate → cache-aside → log) — Redis-backed now that Upstash is real (was in-memory fallback before)
- All adapters **live-verified against real running endpoints with real credentials**:
  - [x] Open-Meteo (weather) → `WeatherPanel`
  - [x] USGS earthquakes → `EarthquakeLayer` **+ now persists every fetch to `cached_earthquakes` for Replay mode** (see Phase 5)
  - [x] CelesTrak + SGP4 → `IssLayer`
  - [x] OpenSky (flights) → `FlightsLayer` — **now uses a registered OAuth2 client** (`OPENSKY_CLIENT_ID/SECRET`, ~4000 credits/day vs anonymous ~400/day, 10s cache TTL vs 45s); anonymous quota was hit and confirmed via a real 429 mid-session, verified the OAuth token exchange + authenticated call live before wiring it in
  - [x] NOAA SWPC (Kp) → `SpaceWeatherPanel`
  - [x] sunrise-sunset.org → `SunMoonPanel`
  - [x] Nominatim geocoding → command palette search
  - [x] Moon phase — client-side `suncalc`
  - [x] **NASA FIRMS (wildfires)** → `WildfireLayer`, off by default (first fetch in a 3hr window takes ~90s against the full global VIIRS scope; shared via Redis cache-aside across all users, so only the very first request per window pays that cost)
  - [x] **OpenAQ (air quality)** → `AirQualityPanel` — rewritten to join `/v3/locations` (sensor metadata) with `/v3/locations/{id}/latest` (actual readings); the original adapter only located stations, never fetched values
  - [x] **GeoNames (timezone)** → inline in `WeatherPanel`
  - [x] **NASA DONKI (space weather events)** → expandable list in `SpaceWeatherPanel`
- Not started (unchanged from before, still real gaps):
  - [ ] Open-Meteo elevation, NWS alerts, NOAA radar, Smithsonian GVP volcanoes, GDACS, NASA EPIC/APOD/NeoWs, OurAirports, NOAA NDBC/CO-OPS/NHC, REST Countries/Wikidata, Blitzortung lightning, AISHub ships
- [ ] SSE endpoints for ISS + flights fan-out *(still client polling — fine at current scale)*
- [x] Redis-backed rate limiter — `/api/geocode`
- [ ] Scheduled cron (cache pre-warming, notification sweep, bulk re-sync) — **still blocked**, needs an interactive `vercel link` this environment can't run

## Phase 3 — Globe core

- [x] CesiumJS + Resium, code-split
- [x] **Wireframe globe (current look)** — black `globe.baseColor`, no imagery/terrain provider (`EllipsoidTerrainProvider`, flat), real country borders (`<GeoJsonDataSource>`, Natural Earth 1:110m, bundled static at `public/data/ne_110m_admin_0_countries.geojson`) and a generated lat/long graticule (`src/lib/graticule.ts`), both as glowing lines (`PolylineGlowMaterialProperty`). Replaces the photoreal build below by explicit request — see git history for that version if it's ever wanted back.
- [x] ~~Cesium World Terrain, Bing/OSM base imagery, GIBS true-color cloud overlay, GIBS Black Marble night-lights overlay, `skyAtmosphere` hue/saturation/brightness tuning~~ — **removed**, superseded by the wireframe globe above. `NEXT_PUBLIC_CESIUM_ION_TOKEN` is now unused (left in `.env.example`, harmless).
- [x] **Real low-poly 3D models** — flights and the ISS render as real glTF models (`public/models/airplane.glb`, CC-BY 3.0 via Poly Pizza; `public/models/satellite.glb`, CC0 via Kenney), not flat icons. Flights orient to real `headingDeg` via `Transforms.headingPitchRollQuaternion`. Replaces the earlier `icon-billboard.ts` icon system (deleted).
- [x] **Glow markers** — earthquakes/wildfires render as soft radial-gradient glow billboards (`src/lib/glow-billboard.ts`) instead of technical icon glyphs, readable without knowing what a seismograph/flame pictogram means; size/color still driven by real magnitude/brightness.
- [x] **Capital-city places layer** — 199 real national capitals (Natural Earth `ne_110m_populated_places.geojson`, filtered to `ADM0CAP === 1`, bundled static at `public/data/capitals.geojson`) render as glow dots with zoom-gated name labels (`PlacesLayer.tsx`). REST Countries (originally planned) turned out to require an API key as of its v5 migration.
- [x] Real-time lighting, camera + fly-to, measurement tool, screenshot/fullscreen, WASD fly controls
- [x] **Wildfire markers**, capped at 1000 (`MAX_FIRES` in `firms.ts` — global VIIRS 24h feed runs 30k-100k+ rows, was crashing the tab before this cap)
- [x] **Real unit conversion** (metric/imperial) applied to weather, measurement tool, flight altitude/speed — a units toggle that didn't change any number would be fake, so this was built as a real, shared `src/lib/units.ts`
- [x] **Marker clustering** — earthquakes/flights/wildfires now render inside a `<CustomDataSource clustering={...}>` (`src/lib/use-entity-clustering.ts`) instead of a flat `<Entity>` list; clusters billboards the same as it clustered points before
- [x] **Earthquake heatmap mode** — toggle in the layer panel; canvas-generated additive-blob density map (not a real KDE), same "approximation, disclosed" spirit as the FIRMS caveat
- [x] **Flight trails** — short fading polyline per aircraft, built from real positions accumulated client-side across polls (OpenSky's free tier has no historical track endpoint)
- [x] **Aurora oval** — approximate geomagnetic-pole ellipses, always on, sized/gated by the real live Kp index (`/api/space-weather`) — not the real OVATION model, disclosed as such
- [x] Cinematic space-to-target intro flyby
- [ ] MapLibre minimap, 3D buildings/roads/population — **still not started**, these need offline tile-processing pipelines outside a single session's scope

## Phase 4 — Location & personalization

- [x] Geolocation + IP fallback + fly-to, all local panels (weather/AQI/sun-moon/timezone) populate independently
- [x] Timezone now live (GeoNames) — was the only unverified piece here
- [ ] Elevation, UV, nearby airports, re-query on viewport shift — still not started
- [x] Persist active layers + bookmarks + units to local storage

## Phase 5 — Layers & UI

- [x] Layer panel — **now includes Wildfires**
- [x] Event detail panel — **now handles wildfire events too**
- [x] Bookmarks, measurement tool, coordinate readout, command palette, screenshot/fullscreen, API status panel
- [x] **Settings panel** (`SettingsPanel.tsx`) — real units toggle; theme/language honestly labeled as fixed rather than faked as working dropdowns
- [x] **Statistics dashboard** (`StatsDashboard.tsx`) — live counts only (quakes ≥M2.5, active fires, tracked flights, Kp); no sparklines, since a trend line needs a time series and there's no continuous ingestion cron — faking one would violate the whole project's no-mock-data rule, so it's omitted, not faked
- [x] **Consolidated credits panel** (`CreditsPanel.tsx`)
- [x] **Share-URL encoding** (`src/lib/view-state.ts`) — camera position (sampled on Cesium's `moveEnd`) + active layers encoded into the URL; opening a shared link flies there and restores layers without an account
- [x] **Replay mode** (`ReplayControls.tsx`) — real, not a scaffold: `fetchRecentEarthquakes` now persists every cache-miss fetch into `cached_earthquakes`, and `/api/earthquakes/history` queries that table for a scrubbable 24h window with play/pause. Coverage is only as deep as how long the app has been running and being polled since this shipped — there's no backfill.
- [ ] Notification center — **still out of scope** (would need per-user preferences, and auth is explicitly out of scope)
- [ ] Service worker/offline, i18n — still not started

## Phase 6 — Accessibility & responsive

- [x] Keyboard shortcuts: `L` (layers), `B` (bookmarks), `F` (fullscreen), `R` (replay toggle), `+`/`-` (zoom), `W`/`A`/`S`/`D` (fly), `Space` (replay play/pause), `Esc` (close everything)
- [x] Global `focus-visible` ring (all buttons/links/inputs) and `prefers-reduced-motion` handling added in `globals.css`
- [x] `aria-live`/`role="status"` on WeatherPanel, AirQualityPanel, EventDetailPanel
- [x] **Partial responsive pass**: below `sm`, the ~8 floating utility buttons collapse into one bottom-sheet-style "More" menu; local-conditions cards become a horizontal scroll strip; event detail becomes a full-width sheet. This is *not* the full per-breakpoint bottom-sheet system from the UI spec — it's a real, working reflow, not the complete spec.
- [ ] Full WCAG AA contrast audit, Lighthouse CI gate — not done (would need actual Lighthouse tooling run against a deployed instance)

## Phase 7 — Testing & hardening

- [x] **Vitest coverage for all 11 adapters now** (was 1 of 11) — 14 test files, 28 tests, all passing. Fixtures use the real response shapes verified live this session (including the 3 schema bugs found and fixed earlier: CelesTrak TLE format, SWPC object shape, sunrise-sunset integer day_length).
- [ ] Playwright E2E — not started
- [ ] Scheduled CI canary workflow — not started (the new `ci.yml` covers lint/typecheck/test/build, not a live-shape diff job)
- [x] **CSP + security headers** — `next.config.ts` now sets Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. CORS: no headers added anywhere, which is the correct locked-down (same-origin-only) state per docs — nothing to add.
- [ ] Formal OWASP-table security review — not done as a discrete pass

## Phase 8 — Launch readiness

- [x] Attribution — every panel still credits its own source inline, **and** there's now one consolidated `CreditsPanel` listing all 11 sources
- [x] Cache TTLs verified per adapter
- [ ] Independent status page — not done
- [x] Every "Live" badge maps to a real, currently-polled source; Wildfires/AQI/Timezone/Space-weather-events are now live and wired since real keys exist — nothing on screen overclaims

## Post-launch (V2+ — not v1 blockers)

See [11-roadmap.md](docs/11-roadmap.md).

---

## What's still genuinely blocked (not skipped, actually can't do it here)

- **Vercel Cron / scheduled jobs** — needs an interactive `vercel link`, which this non-interactive environment can't run. This is the one dependency behind: cache pre-warming, a real backfill for Replay/Stats history, and the scheduled CI canary workflow.
- **Full responsive/E2E/Lighthouse/OWASP passes** — these need either a deployed instance, real device testing, or dedicated tooling runs beyond what a code-level pass can honestly claim to complete.

## Honest summary of what changed this pass

Everything that was previously gated on "needs a real key/account I don't have" now has one, and every one of those 4 adapters is live, tested, and wired into the UI (not just curled once). On top of that: a real Settings panel, a real (not sparkline-faked) stats dashboard, a consolidated credits panel, working share-URLs, a genuinely functional Replay mode backed by data the app is now organically accumulating in its own Neon database, a real accessibility pass (keyboard shortcuts, focus rings, aria-live, reduced-motion), a real partial responsive pass, CSP/security headers, a GitHub Actions CI workflow, and full adapter test coverage (11/11, up from 1/11).

**One incident during this session**: verifying the final state, an `rm -rf .next` aimed at an isolated check collided with the user's own already-running `npm run dev` (same directory, same `.next` cache, different intent) and left that terminal's server returning 500. Fixed by restarting `npm run dev` in that terminal — no code was lost, confirmed via a clean build that completed just before the incident.
