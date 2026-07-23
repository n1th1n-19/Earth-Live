# 3. Software Architecture Document

## 3.1 System overview

Earth Live is a server-rendered web application with a heavy, stateful client (the globe) and a thin, cache-first backend. The backend's primary job is **not** to compute anything — it is to sit between the client and ~20 independent third-party APIs, normalize their responses, cache them within each API's rate limit, and stream them to the client. The database exists for user-owned state (accounts, bookmarks, preferences, notifications) and for logging/caching, not for the live Earth data itself, which is never "owned" by Earth Live and is always fetched fresh (subject to cache TTLs) from source.

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (Next.js App Router, React Server + Client Components)   │
│  - CesiumJS globe (client component, WebGL)                      │
│  - MapLibre GL JS (2D fallback / minimap / measurement overlay)  │
│  - Zustand (client UI state) + TanStack Query (server-state cache)│
└───────────────┬────────────────────────────────────────────────┘
                │ HTTPS (REST + SSE for streaming layers)
┌───────────────▼────────────────────────────────────────────────┐
│  Edge / CDN (Vercel Edge Network)                                 │
│  - Static assets, globe tiles, app shell                          │
│  - Edge-cached API responses (short TTL, per-endpoint)            │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│  API Gateway / BFF layer (Next.js Route Handlers / Fluid Compute) │
│  - Auth, rate limiting, request validation                        │
│  - Per-source adapters (normalize each upstream API's shape)      │
│  - Reads/writes Redis cache before calling upstream                │
└──────┬─────────────┬──────────────┬───────────────┬─────────────┘
       │              │              │               │
┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
│ Redis        │ │ Postgres   │ │ Background   │ │ 20+ external │
│ (Upstash)    │ │ (Neon,     │ │ workers/queue│ │ free APIs    │
│ hot cache    │ │ via Prisma)│ │ (Vercel Cron │ │ (Open-Meteo, │
│              │ │ user data, │ │ + Queues)    │ │ USGS, NASA,  │
│              │ │ cache table│ │              │ │ OpenSky, ...)│
└──────────────┘ └────────────┘ └──────────────┘ └──────────────┘
```

## 3.2 Globe rendering engine: research, comparison, and decision

This is the single most consequential technology decision in the product, so it is documented in full.

### 3.2.1 Candidates evaluated

**CesiumJS** — Open-source (Apache 2.0) WebGL globe engine purpose-built for geospatial visualization. Native WGS84 ellipsoid globe, first-class terrain (quantized-mesh streaming, including free access to Cesium World Terrain via a free Cesium ion account tier), native 3D Tiles support (OGC standard — used for photogrammetry, 3D buildings, point clouds), built-in atmosphere/lighting/sun-position simulation, native time-dynamic visualization (the `Clock`/`Entity` API is designed exactly for "objects that move over real time," e.g. flights and satellites). Ion free tier includes a generous asset-streaming allowance sufficient for a moderate-traffic app (global terrain + Bing/other base imagery streaming); above that, usage-based paid tiers exist but are not required for v1.

**MapLibre GL JS** — Open-source (BSD-3, community fork of pre-license-change Mapbox GL JS) vector-tile map renderer. Excellent 2D (and Mapbox-style pseudo-3D via `pitch`) performance, huge ecosystem, free forever (no vendor tile lock-in — works with any vector tile source including free self-hosted OSM tiles). Its "globe projection" mode (shipped in recent releases) renders a 3D-looking sphere but is fundamentally a projected map, not a true ellipsoid globe with terrain-aware ray casting — camera behavior, terrain occlusion, and true 3D entity placement (e.g., a satellite at real orbital altitude) are not native strengths.

**Three.js** — General-purpose WebGL/WebGPU 3D library. No geospatial primitives at all out of the box — a globe, terrain LOD, tile streaming, coordinate systems, and camera controls would all have to be built or assembled from third-party plugins. Maximum flexibility, maximum build cost.

**deck.gl** — WebGL2/WebGPU framework for large-scale data visualization layers, built by the former Uber visualization team, typically paired with a base map (Mapbox/MapLibre or a Google base map). Exceptional at rendering huge point/arc/heatmap datasets performantly (e.g., a global flight dataset with tens of thousands of points) but is a *data-layer* library, not a globe-rendering engine — it doesn't provide terrain, atmosphere, or a globe camera model on its own.

**Babylon.js** — General-purpose WebGL/WebGPU game engine, excellent PBR rendering and a full scene graph, but like Three.js has no built-in geospatial layer — a production geospatial globe on Babylon means building Cesium's feature set from scratch.

**Mapbox GL JS** — As of the license change (v2+, effective 2021), Mapbox GL JS is proprietary and requires a paid Mapbox account/access token above a free usage tier. Given the "free-tier-first" constraint, Mapbox is disqualified as the *primary* renderer; MapLibre (its permissively-licensed fork of the last open version) is the correct substitute wherever Mapbox-style 2D vector maps are wanted.

### 3.2.2 Decision matrix

| Criterion | CesiumJS | MapLibre GL | Three.js | deck.gl | Babylon.js |
|---|---|---|---|---|---|
| True WGS84 3D globe, out of the box | ✅ Native | ⚠️ Projection trick | ❌ Build yourself | ❌ N/A (needs base map) | ❌ Build yourself |
| Terrain streaming (quantized mesh, LOD) | ✅ Native, free tier via Cesium ion | ❌ Not applicable to vector tiles | ❌ Manual | ❌ N/A | ❌ Manual |
| Time-dynamic entities (flights, satellites, ISS moving in real time) | ✅ Native `Clock`/`Entity`/`SampledPosition` | ⚠️ Manual via custom layers | ❌ Manual | ✅ Excellent for huge point counts | ❌ Manual |
| Real-time sun position / atmosphere / day-night terminator | ✅ Native | ❌ Manual shader | ❌ Manual | ❌ N/A | ❌ Manual |
| 3D Tiles (buildings, photogrammetry) | ✅ Native (OGC 3D Tiles) | ⚠️ Fill-extrusion only (2.5D) | ❌ Manual | ❌ N/A | ❌ Manual |
| License cost at scale | Free (Apache 2.0); ion free tier sufficient for v1 | Free (BSD-3), fully self-hostable | Free (MIT) | Free (MIT) | Free (Apache 2.0) |
| Raw large-point-dataset rendering perf (10k+ flights) | Good | N/A | Manual | ✅ Best-in-class | Manual |
| Ecosystem maturity for *this exact domain* | ✅ Purpose-built (NASA-lineage — originally built for a virtual-globe project) | General maps | General 3D | General big-data viz | General 3D/games |
| Learning curve for a geospatial product team | Moderate (domain-specific API) | Low | High (build everything) | Moderate | High |

### 3.2.3 Decision

**Primary 3D globe: CesiumJS.** It is the only candidate that natively provides a true ellipsoid globe, streamed terrain, real-time sun/atmosphere lighting, and time-dynamic entity positioning — which is to say, it natively provides roughly 70% of Earth Live's rendering requirements before a single custom layer is written. Building the same feature set on Three.js or Babylon.js is a multi-quarter effort duplicating what Cesium already ships; deck.gl and MapLibre are excellent but solve adjacent problems (big-data point rendering, 2D vector maps) rather than the core "digital twin globe" requirement.

**Secondary: MapLibre GL JS** for (a) the lightweight minimap/locator widget, (b) 2D print/share views where a full WebGL globe context is unnecessary overhead, and (c) as the renderer behind the measurement tool's flat-projection mode, which is more intuitive for area/distance drawing than doing it on a curved globe surface. MapLibre is also the renderer of choice if a future "lite mode" (low-end device / data-saver) ships a 2D-only experience.

**deck.gl is reserved for a v1.x optimization** if profiling shows Cesium's native `PointPrimitiveCollection`/`Entity` rendering becoming a bottleneck once live flight counts exceed roughly 5,000–10,000 simultaneous aircraft (global OpenSky states can approach this order of magnitude at peak). Cesium supports embedding custom WebGL layers, so deck.gl can be added later without a rewrite — noted here as an explicit, deferred architectural option rather than a v1 dependency.

**Three.js and Babylon.js are not used.** Neither offers a return on the significant custom-engineering cost they'd require to reach feature parity with Cesium for this specific product.

### 3.2.4 What Cesium provides, mapped to Earth Live features

- **Terrain:** Cesium World Terrain (global quantized-mesh DEM) via Cesium ion's free tier, giving real elevation under every camera movement — directly satisfies the "elevation" requirement in local conditions (FR-7) and the terrain reference layer.
- **Imagery:** Cesium supports any standard imagery provider (WMS/WMTS/TMS/XYZ). Earth Live uses free, open imagery sources (see [05-api-integration-guide.md](05-api-integration-guide.md) §Maps & Imagery) rather than a paid Cesium ion imagery asset, keeping base-map costs at zero.
- **Lighting:** Cesium's `Globe.enableLighting` and `Scene.light` compute real sun position for the current time, which directly produces the live day/night terminator (FR-1) with zero custom math.
- **Clouds:** Rendered as a translucent equirectangular texture overlay updated from live cloud-cover model data (Open-Meteo), mapped onto a slightly-inflated sphere above the terrain — a standard Cesium technique (`ImageryLayer` with alpha blending), not a Cesium built-in feature per se.
- **Night lights:** Same imagery-layer mechanism, toggled as an alternate base layer, sourced from a static/periodic composite (see API guide — explicitly not live).
- **Camera controls:** Cesium's `ScreenSpaceCameraController` provides tuned pan/zoom/tilt/rotate out of the box, customized for touch vs. mouse input.
- **Performance / LOD:** Cesium's terrain and imagery quadtree automatically streams higher-resolution tiles only as the camera approaches — this is the mechanism that keeps frame rate high (NFR/performance targets in [09-performance-guide.md](09-performance-guide.md)) without hand-rolled LOD logic.
- **Tile streaming:** Standard HTTP tile requests, cacheable at the CDN edge exactly like any other static asset.
- **3D buildings:** OSM building footprints, extruded via Cesium's 3D Tiles pipeline (pre-processed offline from OSM/Overture Foundation data into a Cesium-ion-hosted or self-hosted 3D Tiles tileset) — enabled only at close zoom (city-level) to protect performance.

## 3.3 Frontend architecture

- **Framework:** Next.js (App Router), deployed on Vercel. Server Components render the static app shell, navigation, and SEO-relevant marketing/landing content; the globe itself and all live-data panels are Client Components (WebGL and browser Geolocation/Fullscreen/Share APIs all require the client).
- **Data fetching:** TanStack Query manages all server-state (weather, quakes, flights, etc.) with per-layer `staleTime`/`refetchInterval` tuned to that layer's real update cadence (see the refresh-interval column in [05-api-integration-guide.md](05-api-integration-guide.md)) — this is the client-side half of respecting upstream rate limits; the backend cache is the other half.
- **Streaming layers:** For high-frequency data (ISS position, live flight positions), the BFF exposes a Server-Sent Events (SSE) endpoint that itself polls upstream at a safe interval and fans out to all connected clients — this means 10,000 concurrent Earth Live users produce *one* upstream polling loop, not 10,000, which is the core scaling lever that keeps every free tier viable regardless of Earth Live's own traffic.
- **UI state:** Zustand for ephemeral client UI state (active layer toggles, panel open/closed, command palette state) — deliberately separate from TanStack Query's server-state cache so the two concerns (what the UI looks like vs. what data it's showing) don't tangle.
- **Web Workers:** Marker clustering/decluttering for dense layers (flights, quakes at low zoom) and great-circle distance/area math for the measurement tool run off the main thread to protect globe frame rate.

## 3.4 Backend / BFF architecture

- **Runtime:** Vercel Fluid Compute (Node.js) for all API route handlers — chosen over traditional one-request-per-instance serverless because Fluid Compute reuses warm instances across concurrent requests, which matters here because many of Earth Live's route handlers are thin proxy/cache-lookups that benefit from connection reuse to Redis/Postgres rather than paying a cold-start+connect cost per request.
- **Per-source adapters:** Each upstream API gets a small, isolated adapter module responsible for: building the authenticated request, parsing/normalizing the response into Earth Live's internal shape, and reporting success/failure to the health-tracking system that powers the "API status" panel (FR-42). Isolating adapters means one upstream's schema change or outage never leaks into another layer's code path.
- **Cache-aside pattern:** Every adapter checks Redis first; on miss, calls upstream, writes the response to Redis with a TTL derived from that source's real refresh cadence (not an arbitrary number), then returns. This is what makes it structurally impossible to exceed an upstream's rate limit under normal load — the limiting factor becomes Redis read latency, not upstream call volume.
- **Background workers / cron:** Vercel Cron (backed by Queues for anything long-running) handles: periodic pre-warming of high-traffic caches (e.g., refresh the global earthquake feed cache every 60s regardless of whether a request is currently in flight, so the first user after a TTL expiry never pays the upstream latency), notification-matching sweeps (checking new events against users' saved-location alert radii), and stale-cache/log pruning.
- **API Gateway concerns (rate limiting, auth, CORS)** are implemented in Next.js Middleware (Fluid-Compute-backed, full Node.js — not the legacy Edge Runtime), fronted by Vercel's platform-level DDoS/bot protection (BotID) for abuse resistance before requests even reach application code.

## 3.5 Caching & CDN

- **CDN (Vercel Edge Network):** Serves the static app shell, JS/CSS bundles, and Cesium terrain/imagery tile requests that are proxied through Earth Live's own domain (see [10-security-guide.md](10-security-guide.md) for why tiles are proxied rather than requested client-to-upstream directly for sources requiring an API key).
- **Redis (Upstash, serverless-friendly, free tier sufficient for v1 traffic):** The hot cache for all upstream API responses, session tokens, and rate-limit counters. Chosen over an in-memory cache because Fluid Compute instances are not guaranteed to be the same instance between requests — a shared cache is required for the cache-aside pattern to actually work across concurrent users.
- **Postgres (Neon, serverless Postgres with a free tier and instant branching for preview environments):** System of record for user accounts, bookmarks, preferences, notifications, and a durable (non-hot-path) copy of recent cached datasets for replay/history features that outlive Redis TTLs. See [06-database-design.md](06-database-design.md).
- **Prisma:** ORM/schema-migration layer over Postgres — chosen for type-safe query generation matching the TypeScript-first stack (see [07-tech-stack.md](07-tech-stack.md)) and first-class migration tooling.

## 3.6 Authentication

- Auth.js (formerly NextAuth.js) with email/password (credentials provider, hashed with argon2) and OAuth (Google, Apple) providers. Sessions are JWT-based, stored in an httpOnly, secure, SameSite=Lax cookie. Auth is entirely optional for the core product (§2.2.15) — the auth system's only job is to unlock cross-device sync, notifications, and search history, not to gate the live-globe experience.

## 3.7 Monitoring, logging, analytics, error tracking

- **Error tracking:** Sentry (frontend + backend) — captures unhandled exceptions, Cesium WebGL context-loss events, and failed-fetch patterns per upstream source, tagged by adapter name so a spike in one API's failures is immediately attributable.
- **Logging:** Structured JSON logs from all route handlers/workers, shipped to Vercel's log drain into a log platform (e.g., Axiom/Datadog free-tier-compatible) — every upstream API call is logged with source, latency, cache hit/miss, and status, which is also the data source for the `api_logs` table and the in-product API Status panel.
- **Analytics:** Privacy-respecting, cookieless product analytics (e.g., Vercel Analytics / Plausible-style) tracking feature usage (layer toggles, search usage, bookmark creation) without third-party ad-tech trackers — consistent with the product's "trustworthy window onto public data" positioning.
- **Monitoring/uptime:** Synthetic checks against both Earth Live's own health endpoint and each upstream API's reachability, feeding the API Status panel and alerting the team (not the end user) when an upstream degrades beyond what caching can mask.

## 3.8 Reverse proxy, rate limiting, edge functions

- All third-party API calls that require a secret key (NASA APIs, OpenAQ, GeoNames, TimeZoneDB, FIRMS `MAP_KEY`) are proxied server-side — the key never reaches the client bundle or network tab. Key-free public sources (Open-Meteo, USGS, Open-Notify, sunrise-sunset.org, REST Countries) may be proxied too, uniformly, so caching and rate limiting apply consistently regardless of whether a given source happens to require a key today.
- Application-level rate limiting (per-IP and, if authenticated, per-user) is implemented with a Redis-backed sliding-window counter in Middleware, protecting both Earth Live's own infrastructure and, transitively, every upstream free-tier quota.
- Edge Middleware also handles geolocation-hint headers (Vercel provides a coarse edge-inferred location) purely as a *fast first paint* hint (show a plausible default view before the browser Geolocation API resolves) — never as a substitute for real GPS or the documented IP-fallback flow.

## 3.9 Scalability notes

The architecture's scaling bottleneck is deliberately pushed to Redis/Postgres/CDN — all horizontally scalable, managed services — rather than to any single upstream free API, because the SSE fan-out and cache-aside patterns mean upstream call volume is a function of *the number of distinct data sources and their refresh cadence*, not *the number of Earth Live users*. This is the architectural property that makes "free-tier-first" viable beyond a toy deployment.
