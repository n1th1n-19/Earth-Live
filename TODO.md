# Earth Live — V1 Build TODO

Derived from [docs/](docs/00-README.md). Ordered roughly by dependency — later phases assume earlier ones are functional. Check off as completed.

## Phase 0 — Project setup

- [ ] Init Next.js (App Router, TypeScript) repo; init git
- [ ] Set up Vercel project, link Neon (Postgres + PostGIS) and Upstash Redis — [08-deployment-guide.md](docs/08-deployment-guide.md)
- [ ] Configure ESLint/Prettier/TypeScript strict mode + custom rule blocking client-side keyed-API calls — [07-tech-stack.md](docs/07-tech-stack.md) §7.3
- [ ] Set up GitHub Actions CI (lint, typecheck, unit tests, build) — [08-deployment-guide.md](docs/08-deployment-guide.md) §8.2
- [ ] Register free API keys/accounts: FIRMS `MAP_KEY`, NASA api.nasa.gov, OpenAQ, GeoNames, Cesium ion — store as scoped Vercel env vars, never committed
- [ ] Set up Sentry (frontend + backend)

## Phase 1 — Database & auth

- [ ] Write Prisma schema for all tables in [06-database-design.md](docs/06-database-design.md) (users, sessions, bookmarks, saved_locations, notifications, notification_preferences, preferences, search_history, cached_weather/earthquakes/flights/wildfires, api_logs)
- [ ] Enable PostGIS, add geography columns + GiST indexes for spatial tables
- [ ] Run first migration against Neon; verify preview-branch-per-PR works
- [ ] Wire up Auth.js: credentials (argon2id) + Google + Apple OAuth
- [ ] Confirm anonymous usage works end-to-end with no auth required (core product must not gate on login)

## Phase 2 — BFF / adapter layer

- [ ] Build the generic adapter pattern (fetch → normalize → Zod-validate → cache-aside via Redis → log to `api_logs`) — [03-architecture.md](docs/03-architecture.md) §3.4
- [ ] Implement adapters per source, each with its documented TTL from [05-api-integration-guide.md](docs/05-api-integration-guide.md) §5.12:
  - [ ] Open-Meteo (weather, air quality, elevation)
  - [ ] NWS/api.weather.gov (US alerts + forecast)
  - [ ] NOAA radar (nowCOAST)
  - [ ] USGS earthquakes (summary feeds + FDSN query)
  - [ ] Smithsonian GVP / USGS volcano alert levels (weekly ingestion job)
  - [ ] NASA FIRMS (wildfires)
  - [ ] GDACS (supplementary hazards)
  - [ ] Open Notify (ISS) + CelesTrak TLE ingestion + `satellite.js` SGP4 propagation
  - [ ] NASA APIs (DONKI, EPIC, APOD, NeoWs)
  - [ ] OpenSky Network (flights, SSE fan-out)
  - [ ] OurAirports (bulk CSV ingestion job)
  - [ ] NOAA NDBC (buoys), CO-OPS (tides), NHC (cyclones)
  - [ ] NOAA SWPC (aurora, Kp, solar wind, X-ray flux)
  - [ ] Nominatim (geocoding, proxied + cached, respect 1 req/s)
  - [ ] GeoNames (timezone-by-coordinate)
  - [ ] REST Countries, Wikidata (optional enrichment)
  - [ ] Blitzortung community feed (lightning — best-effort, flag coverage caveat)
  - [ ] AISHub (ships — only if a sharing arrangement is secured; else omit layer)
- [ ] SSE endpoints for ISS + flights fan-out
- [ ] Redis-backed rate limiter (`@upstash/ratelimit`) on mutating + search/geocoding endpoints
- [ ] Scheduled cron: cache pre-warming for hot layers, notification-matching sweep, weekly OSM/GVP/OurAirports re-sync

## Phase 3 — Globe core

- [ ] Integrate CesiumJS + Resium, code-split from initial bundle — [03-architecture.md](docs/03-architecture.md) §3.2
- [ ] Configure Cesium ion account, stream Cesium World Terrain
- [ ] Base imagery layer (free/open source, no paid Cesium ion imagery asset)
- [ ] Enable real-time lighting/sun position for live day/night terminator
- [ ] Camera controls tuned for mouse/touch; fly-to animation helper
- [ ] Cloud-cover translucent overlay (processed from Open-Meteo cloud data into tile pyramid)
- [ ] Night-lights static/periodic overlay (NASA Black Marble), clearly labeled non-live
- [ ] MapLibre GL JS integration for minimap / measurement flat-projection mode

## Phase 4 — Location & personalization

- [ ] Browser Geolocation API flow with contextual permission prompt
- [ ] IP-geolocation fallback + "use precise location" retry action
- [ ] Fly-to-user-location on grant; populate local panels progressively (non-blocking) — weather, day/night, sunrise/sunset (sunrise-sunset.org), moon phase (`suncalc`, client-side), timezone (`Intl` for own device, GeoNames for arbitrary points), elevation, UV, AQI, nearby quakes/wildfires/airports/flights
- [ ] Re-query "nearby" panels on >50km viewport shift
- [ ] Persist last camera position + layers (local storage; synced to `preferences` if authenticated)

## Phase 5 — Layers & UI

- [ ] Layer panel: categorized, collapsible, liveness badge + last-updated per row — [04-ui-ux-spec.md](docs/04-ui-ux-spec.md)
- [ ] Implement each layer's renderer (weather grid, wind particles, quake/fire/volcano markers, flight icons, ISS/satellite entities, borders/roads/3D buildings, population, aurora overlay)
- [ ] Marker clustering in a Web Worker for dense low-zoom layers
- [ ] Event detail panel (shared template) with attribution + source link
- [ ] Bookmarks (anon via local storage + authenticated sync)
- [ ] Measurement tool (distance + area, great-circle math in Web Worker)
- [ ] Coordinate readout (decimal ↔ DMS toggle) + share-URL encoding of full view state
- [ ] Command palette (`cmdk`): places, bookmarks, layers, actions
- [ ] Replay mode: time-range scrubber, historical queries for quakes/fires/cyclones, persistent "not live" banner
- [ ] Statistics dashboard (stat tiles + sparklines via `recharts`)
- [ ] Notification center + push subscription + per-saved-location alert radius matching
- [ ] Settings (units, theme, language, default layers, data-saver mode)
- [ ] Service worker: offline app shell + last-known-layer-state caching
- [ ] Screenshot capture + Fullscreen API toggle
- [ ] i18n scaffolding + en/es/fr locales
- [ ] API status / data-sources transparency panel

## Phase 6 — Accessibility & responsive

- [ ] Keyboard path for every action; visible focus states; `aria-live` regions for layer updates
- [ ] Verify 4.5:1 contrast over busiest glass-panel backdrop
- [ ] `prefers-reduced-motion` handling (camera + panel transitions)
- [ ] Responsive pass across mobile/tablet/foldable/desktop/ultra-wide breakpoints — [04-ui-ux-spec.md](docs/04-ui-ux-spec.md) §4.7
- [ ] Lighthouse CI gate (Performance ≥90, Accessibility ≥95)

## Phase 7 — Testing & hardening

- [ ] Vitest: adapter normalization, spatial helpers, SGP4 math
- [ ] Playwright E2E: first-visit → geolocation → localized data; search → fly-to; bookmark persistence; offline degraded state
- [ ] Scheduled CI canary workflow diffing each adapter's live shape against stored fixtures
- [ ] CSP headers, CORS lockdown to own origin, argon2id verification, rate-limit tests
- [ ] Security review against [10-security-guide.md](docs/10-security-guide.md) OWASP table

## Phase 8 — Launch readiness

- [ ] Attribution/credits panel covering every source requiring it (Open-Meteo, OpenAQ, FIRMS, CelesTrak, OpenSky, OSM/Nominatim, GeoNames, NDBC, NHC, SWPC, etc.)
- [ ] Confirm no upstream free-tier ceiling is breachable under expected load (cache TTLs match §5.12 table)
- [ ] Independent status page (low-dependency host) for platform-outage communication
- [ ] Final pass: every "Live" badge in the UI actually maps to a source polled within its documented interval; no mock/placeholder data anywhere

## Post-launch (V2+ — not v1 blockers)

See [11-roadmap.md](docs/11-roadmap.md): direct Copernicus CDS/Marine integration, self-hosted Nominatim/OpenTopoData, JTWC global cyclone coverage, public API/SDK, mobile/desktop/wearable clients, browser extension, widgets.
