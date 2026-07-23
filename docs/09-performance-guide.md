# 9. Performance Guide

## 9.1 Budgets (restated from §1.5, with the techniques that hit them)

| Target | Value |
|---|---|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Time to first meaningful paint of the globe | < 2.5s on median mobile 4G |
| Time from geolocation grant to localized data populated | < 3s |
| Globe frame rate during camera movement | ≥ 55 FPS (2021-era laptop GPU), ≥ 30 FPS (mid-tier phone) |

## 9.2 Rendering performance (the globe)

- **Terrain/imagery LOD is handled by Cesium's own quadtree streaming** (§3.2.4) — the engineering task is to *not defeat it*: keep custom overlay layers (cloud texture, night lights) at a resolution that doesn't force excessive re-tiling, and avoid attaching per-frame React re-renders to camera movement (camera state changes are read imperatively from the Cesium `Viewer` instance, not piped through React state on every frame).
- **Entity count management:** Flights and dense low-zoom quake/fire markers are the primary risk to frame rate. Below a configurable zoom threshold, markers are clustered (computed in a Web Worker, §3.3) rather than rendered as individual entities; above the threshold (city-level zoom), individual entities render directly since counts are naturally low at that scale.
- **Deferred deck.gl option:** If profiling shows Cesium's native entity collections becoming the bottleneck at global flight-density peaks (~5,000–10,000+ concurrent aircraft), deck.gl is added as a custom WebGL layer within the existing Cesium scene rather than a rewrite — documented as a deferred, not default, optimization in [03-architecture.md](03-architecture.md) §3.2.3.
- **Texture overlay budget:** Cloud-cover and night-lights imagery layers are pre-processed server-side into web-optimized tile pyramids (not raw satellite-resolution assets streamed uncompressed) — this is a batch image-processing step in the periodic ingestion jobs (§3.4), not a runtime cost.
- **`prefers-reduced-motion`** shortens/simplifies both Framer Motion UI transitions and Cesium fly-to camera animation duration, per [04-ui-ux-spec.md](04-ui-ux-spec.md) §4.5 — this is an accessibility requirement that also happens to reduce sustained rendering load for users who've opted into it.

## 9.3 Rendering strategy (App Router)

- **Server Components** render the app shell, marketing/landing surfaces, and any SEO-relevant static content — shipped with zero client JS for those portions.
- **Streaming SSR** (React Suspense boundaries) lets the app shell paint immediately while the Cesium bundle (the largest single dependency in the app) loads asynchronously behind a lightweight placeholder/skeleton globe, directly targeting the "first meaningful paint" budget above without blocking on the full WebGL init.
- **Client Components** are scoped tightly to what actually needs the browser (globe canvas, Geolocation/Fullscreen/Share API usage, interactive panels) — data-only, non-interactive portions stay server-rendered wherever feasible.

## 9.4 Data loading strategy

- **Progressive population, never blocking:** Per FR-7, each localized panel (weather, AQI, nearby quakes, etc.) resolves and renders independently as its own TanStack Query request completes — the slowest upstream API never blocks the fastest one from appearing, which is what actually determines the perceived "time to localized data populated" budget rather than a single aggregate loading state.
- **SSE fan-out for high-frequency layers** (ISS, flights) means the client subscribes to one stream rather than polling — reduces both client request overhead and, per [03-architecture.md](03-architecture.md) §3.3, the upstream call volume that would otherwise scale with concurrent users.
- **`staleTime`/`refetchInterval` tuned per source** (table in [05-api-integration-guide.md](05-api-integration-guide.md) §5.12) — the client never polls faster than the data can actually change, which is both a correctness property (no wasted requests) and a performance one (no wasted re-renders).

## 9.5 Web Workers

Offloaded from the main thread: marker clustering/decluttering computation, great-circle distance/bearing and polygon-area math for the measurement tool, and SGP4 orbital propagation for the full active-satellite catalog (when that layer is enabled) — all CPU-bound work that would otherwise compete with Cesium's render loop for main-thread time.

## 9.6 Caching

- **Tile caching:** Terrain/imagery/vector tiles are immutable per coordinate+zoom+layer-version and cached at the CDN edge with long `s-maxage`/`immutable` headers; the service worker additionally caches recently-viewed tiles for the offline "last known state" requirement (FR-35).
- **API response caching:** Covered exhaustively in [05-api-integration-guide.md](05-api-integration-guide.md) §5.12 (Redis TTL per source) and [03-architecture.md](03-architecture.md) §3.5 (cache-aside pattern) — restated here only as a performance lever: a cache hit resolves in single-digit milliseconds from Redis versus hundreds of milliseconds for most upstream calls, so cache hit rate is a primary lever on the "time to localized data" budget.

## 9.7 Bundle size & lazy loading

- **Cesium is code-split** and loaded only once the globe view is actually about to mount (not part of the initial app-shell bundle), since it is by far the largest dependency in the stack.
- **Route-based code splitting** (native to Next.js App Router) ensures the statistics dashboard, settings, and any secondary routes don't inflate the primary globe view's initial bundle.
- **MapLibre is also lazy-loaded**, only when a surface that actually uses it (minimap, measurement tool's flat-projection mode) is invoked.
- **Icon and chart libraries are tree-shaken** (`lucide-react`, `recharts` both support this natively) so only used icons/chart primitives ship.

## 9.8 Measurement & regression prevention

- Lighthouse CI runs on every PR against the preview deployment, failing the build if the Performance or Accessibility score regresses below the budget thresholds in §9.1.
- Sentry Performance tracing flags slow adapter calls (feeding back into cache-TTL tuning decisions) and long main-thread tasks during Cesium scene updates.
- A synthetic frame-rate check (recorded via Playwright + Chrome DevTools Protocol tracing) runs against a scripted camera-movement sequence in CI as a coarse regression guard for the FPS budget, acknowledging this is a proxy for, not a full replacement for, manual device testing across the responsive breakpoints in [04-ui-ux-spec.md](04-ui-ux-spec.md) §4.7.
