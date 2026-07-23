# Earth Live — V1 Build TODO

Derived from [docs/](docs/00-README.md). Ordered roughly by dependency — later phases assume earlier ones are functional. Check off as completed.

## Phase 0 — Project setup

- [x] Init Next.js (App Router, TypeScript) repo; init git
- [ ] Set up Vercel project, link Neon (Postgres + PostGIS) and Upstash Redis — [08-deployment-guide.md](docs/08-deployment-guide.md) *(needs your Vercel account — `vercel link` can't run non-interactively)*
- [x] Configure ESLint/TypeScript strict mode — [07-tech-stack.md](docs/07-tech-stack.md) §7.3 *(custom no-client-keyed-fetch lint rule still TODO)*
- [ ] Set up GitHub Actions CI (lint, typecheck, unit tests, build) — [08-deployment-guide.md](docs/08-deployment-guide.md) §8.2 *(no GitHub remote yet)*
- [ ] Register free API keys/accounts: FIRMS `MAP_KEY`, NASA api.nasa.gov, OpenAQ, GeoNames, Cesium ion — needs manual signup, can't self-provision. Adapter code for all four is written and ready in `.env.example`
- [ ] Set up Sentry (frontend + backend)

## Phase 1 — Database & auth

- [x] Write Prisma schema for all tables in [06-database-design.md](docs/06-database-design.md)
- [x] Enable PostGIS, add geography columns for spatial tables *(GiST indexes need a live DB to create — schema has the `Unsupported("geography(...)")` columns ready)*
- [ ] Provision real Neon database, run first migration, verify preview-branch-per-PR works *(schema validates and `prisma generate` succeeds against a placeholder `DATABASE_URL`; no live DB connected yet — blocked on Vercel/Neon account)*
- [ ] Wire up Auth.js: credentials (argon2id) + Google + Apple OAuth *(blocked on real OAuth client secrets)*
- [x] Confirm anonymous usage works end-to-end with no auth required — verified, whole app works with zero auth

## Phase 2 — BFF / adapter layer

- [x] Generic adapter pattern (fetch → normalize → Zod-validate → cache-aside → log) — `src/lib/cache.ts`, `src/lib/api-log.ts`, `src/lib/status-store.ts`. Redis-backed when Upstash env vars are set, in-memory fallback otherwise (verified both code paths)
- Adapters implemented, **live-verified against real running endpoints** (curl'd against a live dev server, not just typechecked — this caught 3 real upstream-schema bugs, see below):
  - [x] Open-Meteo (current weather) — `src/lib/adapters/open-meteo.ts` → `/api/weather`, wired into `WeatherPanel`
  - [x] USGS earthquakes — `src/lib/adapters/usgs-earthquakes.ts` → `/api/earthquakes`, wired into `EarthquakeLayer` on the globe
  - [x] CelesTrak TLE + client-side SGP4 (`satellite.js`) — `src/lib/adapters/celestrak.ts` + `src/lib/satellite-propagation.ts` → `/api/satellites`, wired into `IssLayer` (ISS marker moves live on the globe). **Fixed a real bug**: CelesTrak's `FORMAT=json` is OMM (orbital elements), not literal TLE line strings as first assumed — switched to `FORMAT=tle` and wrote a proper 3-line parser.
  - [x] OpenSky Network (flights, anonymous tier) — `src/lib/adapters/opensky.ts` → `/api/flights`, wired into `FlightsLayer` (capped at 400 markers pending clustering). Confirmed working; global-states responses legitimately take ~15s (~70KB JSON), which the client's `staleTime`/timeout budget should account for.
  - [x] NOAA SWPC (Kp index) — `src/lib/adapters/swpc.ts` → `/api/space-weather`, wired into `SpaceWeatherPanel`. **Fixed a real bug**: assumed the old array-of-arrays-with-header-row shape; the live endpoint returns an array of `{time_tag, Kp, a_running, station_count}` objects — schema rewritten to match.
  - [x] sunrise-sunset.org — `src/lib/adapters/sunrise-sunset.ts` → `/api/sun`, wired into `SunMoonPanel`. **Fixed a real bug**: assumed `day_length` was an `"HH:MM:SS"` string; the live API returns a plain integer seconds count — schema and normalize() fixed.
  - [x] Nominatim geocoding — `src/lib/adapters/nominatim.ts` → `/api/geocode` (rate-limited), wired into the command palette search
  - [x] Moon phase — `src/lib/moon.ts`, client-side `suncalc`, no API needed (per docs §5.8 decision)
- Adapters **written but UNTESTED** — need a real key I don't have; code is complete and follows the documented response shapes, but has never made a real successful call. Not wired into any UI layer until verified:
  - [ ] NASA FIRMS (wildfires) — `src/lib/adapters/firms.ts` → `/api/wildfires`, needs `FIRMS_MAP_KEY`
  - [ ] OpenAQ (air quality stations) — `src/lib/adapters/openaq.ts` → `/api/air-quality`, needs `OPENAQ_API_KEY`
  - [ ] GeoNames (timezone-by-coordinate) — `src/lib/adapters/geonames.ts` → `/api/timezone`, needs `GEONAMES_USERNAME`
  - [ ] NASA DONKI (space weather events) — `src/lib/adapters/nasa-donki.ts` → `/api/space-weather-events`, needs `NASA_API_KEY`
- Not started:
  - [ ] Open-Meteo elevation
  - [ ] NWS/api.weather.gov (US alerts + forecast)
  - [ ] NOAA radar (nowCOAST)
  - [ ] Smithsonian GVP / USGS volcano alert levels (weekly ingestion job)
  - [ ] GDACS (supplementary hazards)
  - [ ] NASA EPIC, APOD, NeoWs
  - [ ] OurAirports (bulk CSV ingestion job)
  - [ ] NOAA NDBC (buoys), CO-OPS (tides), NHC (cyclones)
  - [ ] REST Countries, Wikidata (optional enrichment)
  - [ ] Blitzortung community feed (lightning — best-effort, flag coverage caveat)
  - [ ] AISHub (ships — only if a sharing arrangement is secured; else omit layer)
- [ ] SSE endpoints for ISS + flights fan-out *(currently client polling per-layer, not server fan-out — fine at current scale, revisit per docs §3.3 before real traffic)*
- [x] Redis-backed rate limiter (`@upstash/ratelimit`) — `src/lib/rate-limit.ts`, applied to `/api/geocode` *(only geocoding has a mutating/quota-sensitive shape right now; extend to other routes as they gain write paths)*
- [ ] Scheduled cron: cache pre-warming, notification-matching sweep, weekly OSM/GVP/OurAirports re-sync *(needs Vercel Cron, blocked on Vercel project)*

## Phase 3 — Globe core

- [x] Integrate CesiumJS + Resium, code-split (`next/dynamic`, `ssr:false`) — `src/components/globe/Globe.tsx`
- [ ] Configure Cesium ion account, stream Cesium World Terrain *(currently `EllipsoidTerrainProvider` — no ion token; swap-in point is `Globe.tsx`)*
- [x] Base imagery layer — `OpenStreetMapImageryProvider`, direct to `tile.openstreetmap.org` *(fine for dev; move to the self-hosted OSM tile pipeline from [05-api-integration-guide.md](docs/05-api-integration-guide.md) §5.5 before real traffic — OSM's public tile policy doesn't cover production load)*
- [x] Real-time lighting/sun position for live day/night terminator — `viewer.scene.globe.enableLighting`
- [x] Camera controls (Cesium defaults) + fly-to animation, including command-palette/bookmark-triggered fly-to via `flyToTarget` store field
- [x] Measurement tool — click-to-place points, live great-circle distance readout (`src/lib/geo-math.ts`, unit tested)
- [x] Screenshot capture (canvas → PNG download) and Fullscreen API toggle — both in `FloatingControls`
- [ ] Cloud-cover translucent overlay (processed from Open-Meteo cloud data into tile pyramid)
- [ ] Night-lights static/periodic overlay (NASA Black Marble), clearly labeled non-live
- [ ] MapLibre GL JS integration for minimap / measurement flat-projection mode
- [ ] Marker clustering in a Web Worker for dense low-zoom layers *(flights capped at 400 as a stopgap instead)*
- [ ] 3D buildings, borders, roads, population reference layers

## Phase 4 — Location & personalization

- [x] Browser Geolocation API flow — `src/lib/geolocation.ts`
- [x] IP-geolocation fallback via Vercel's edge geolocation headers — `src/app/api/geo/route.ts` *(no-op in local dev where those headers don't exist; "use precise location" retry button still TODO)*
- [x] Fly-to-user-location on grant; local panels populate independently/non-blocking (FR-7 pattern proven end-to-end)
- [x] Sunrise/sunset + moon phase — `SunMoonPanel`
- [ ] Timezone, elevation, UV, nearby airports *(GeoNames timezone adapter written but unverified — see Phase 2; elevation/UV not started)*
- [ ] Nearby wildfires/AQI *(blocked on FIRMS/OpenAQ keys)*
- [ ] Re-query "nearby" panels on >50km viewport shift
- [x] Persist active layers + bookmarks + units to local storage (Zustand `persist`) *(camera position not yet persisted)*

## Phase 5 — Layers & UI

- [x] Layer panel: categorized, collapsible, on/off + cadence per row — `LayerPanel.tsx` *(only lists layers with a real renderer — weather/earthquakes/flights/ISS; not a fake toggle list)*
- [x] Event detail panel (shared template) with attribution + source link — `EventDetailPanel.tsx`, used by earthquakes and flights
- [x] Bookmarks (anon, local storage) — `BookmarksPanel.tsx` *(authenticated sync blocked on auth)*
- [x] Measurement tool — see Phase 3
- [x] Coordinate readout (decimal ↔ DMS toggle) — `CoordinateReadout.tsx` *(share-URL encoding of full view state not done)*
- [x] Command palette (`cmdk`): places (live Nominatim search), bookmarks, layer toggles — `CommandPalette.tsx`, `Cmd/Ctrl+K` and `/`
- [x] Screenshot capture + Fullscreen API toggle — see Phase 3
- [x] API status / data-sources transparency panel — `ApiStatusPanel.tsx`, reads real per-adapter success rate from this session's actual calls
- [ ] Replay mode: time-range scrubber, historical queries, persistent "not live" banner *(needs `cached_earthquakes`/etc. — blocked on live DB)*
- [ ] Statistics dashboard (stat tiles + sparklines via `recharts`)
- [ ] Notification center + push subscription *(blocked on auth + DB)*
- [ ] Settings panel UI *(units field exists in the store; no settings screen to change it yet)*
- [ ] Service worker: offline app shell + last-known-layer-state caching
- [ ] i18n scaffolding + en/es/fr locales
- [ ] Share-URL encoding of full view state

## Phase 6 — Accessibility & responsive

- [ ] Keyboard path for every action; visible focus states; `aria-live` regions for layer updates *(command palette has keyboard nav via cmdk; the rest of the chrome doesn't yet)*
- [ ] Verify 4.5:1 contrast over busiest glass-panel backdrop
- [ ] `prefers-reduced-motion` handling
- [ ] Responsive pass across mobile/tablet/foldable/desktop/ultra-wide breakpoints — [04-ui-ux-spec.md](docs/04-ui-ux-spec.md) §4.7 *(current layout is desktop-only, fixed absolute positioning — genuinely not done, not just untested)*
- [ ] Lighthouse CI gate (Performance ≥90, Accessibility ≥95)

## Phase 7 — Testing & hardening

- [x] Vitest: `geo-math` (haversine/path distance), `moon` phase, `satellite-propagation` (SGP4), `usgs-earthquakes` (adapter normalization with mocked fetch) — 11 tests, all passing (`npm test`)
- [ ] Vitest coverage for the other 7 adapters
- [ ] Playwright E2E: first-visit → geolocation → localized data; search → fly-to; bookmark persistence; offline degraded state
- [ ] Scheduled CI canary workflow diffing each adapter's live shape against stored fixtures *(needs CI, see Phase 0)*
- [ ] CSP headers, CORS lockdown to own origin, rate-limit tests *(argon2id N/A — no auth yet)*
- [ ] Security review against [10-security-guide.md](docs/10-security-guide.md) OWASP table

## Phase 8 — Launch readiness

- [ ] Attribution/credits panel covering every source requiring it *(individual panels credit their own source inline — e.g. WeatherPanel says "Weather data by Open-Meteo.com" — but there's no single consolidated credits panel yet)*
- [x] Confirm cache TTLs match the §5.12 table for every implemented adapter — verified per-adapter against the doc while writing each one
- [ ] Independent status page (low-dependency host) for platform-outage communication
- [x] Every "Live" badge in the UI maps to a source actually polled within its documented interval; the 4 untested keyed adapters are explicitly NOT wired into the UI, so nothing on screen overclaims — no mock/placeholder data anywhere

## Post-launch (V2+ — not v1 blockers)

See [11-roadmap.md](docs/11-roadmap.md): direct Copernicus CDS/Marine integration, self-hosted Nominatim/OpenTopoData, JTWC global cyclone coverage, public API/SDK, mobile/desktop/wearable clients, browser extension, widgets.

---

## Honest summary of what's real right now

Run `npm run dev` and you get: a live CesiumJS globe, your real GPS location (or Vercel's IP hint, or a default view), live weather, live sunrise/sunset + computed moon phase, live earthquakes from the last 24h as clickable magnitude-scaled markers, live flights (OpenSky, capped at 400), the ISS moving in real time via actual orbital mechanics, live Kp geomagnetic index, a working command palette with live place search, click-to-bookmark (persisted), a measurement tool, screenshot/fullscreen, and an API status panel showing real per-source success rates from calls made during your session. `npm run build` and `npm test` both pass, both verified clean from a fully cold `.next`.

This was actually exercised end-to-end, not just typechecked: every route above was curl'd against a running dev server, which caught 4 real bugs a typecheck-only pass would have missed —
1. `satellite.js@7` ships a WASM+`node:worker_threads` runtime with no pure-JS browser export; it doesn't just fail to bundle, it deadlocked Turbopack's build worker over IPC for 19+ minutes with no error, which took a `--webpack` fallback build (which fails loudly instead) to diagnose. Downgraded to `satellite.js@6` (last pure-JS major).
2. CelesTrak's `FORMAT=json` is OMM orbital elements, not TLE line strings — switched to `FORMAT=tle` and wrote a real parser.
3. NOAA SWPC's Kp endpoint returns objects, not the array-of-arrays shape assumed from memory.
4. sunrise-sunset.org's `day_length` is a plain integer, not `"HH:MM:SS"`.

Also found and killed: a zombie `next dev` process from earlier in the session that never actually died, silently corrupting `.next`'s cache via concurrent writes during every build attempt — a compounding cause of the same hang, independent of the satellite.js bug.

What's not real: anything needing an account I can't create (Vercel/Neon/Upstash-in-prod/Sentry/OAuth/Cesium-ion/GitHub Actions), the 4 keyed adapters (FIRMS/OpenAQ/GeoNames/NASA DONKI — code exists, never made a real call, not wired into the UI), and most of Phases 5–8 (replay, stats dashboard, notifications, settings UI, responsive/mobile layout, i18n, offline, full a11y pass, E2E tests, security hardening, launch checklist).
