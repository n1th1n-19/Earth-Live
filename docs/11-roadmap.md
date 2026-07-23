# 11. Development Roadmap

## Version 1 — Launch

Scope is exactly [02-product-requirements.md](02-product-requirements.md): interactive CesiumJS globe, real-GPS-first localization with IP fallback, the full weather/environment/geological/space/transportation/marine layer set on free live APIs, search, bookmarks (anon + authenticated), measurement tool, coordinates/sharing, command palette, replay mode for quakes/fires/cyclones, statistics dashboard, notifications, settings, offline last-known-state, screenshots/fullscreen, 3 initial locales, and the API status/transparency panel. No AI. No paid data tiers required.

**Explicit v1 honesty constraints carried from [05-api-integration-guide.md](05-api-integration-guide.md) §5.11:** lightning and ships/AIS ship as best-effort/partial or are omitted if no community-feed arrangement is secured before launch; moon phase, night lights, and population are correctly labeled algorithmic/static rather than falsely implied live.

## Version 2 — Depth & richness

- **Direct Copernicus CDS / Copernicus Marine integration** (§5.2, §5.7) beyond the current Open-Meteo-mediated path, enabling higher-resolution or longer-range environmental layers now that usage patterns from v1 inform which layers are worth the added batch-ingestion complexity.
- **Self-hosted Nominatim (or a higher-throughput geocoding provider)** once traffic approaches the public instance's 1 req/s ceiling (§5.5) — a scaling change flagged in v1, executed in v2 once real usage data justifies it.
- **Self-hosted OpenTopoData / terrain-RGB pipeline** to remove the Cesium ion streaming-allowance dependency for terrain (§5.9), if v1 usage approaches that limit.
- **Global cyclone coverage completion:** formal JTWC integration alongside NHC (§5.7) for full Western Pacific/Indian Ocean typhoon/cyclone coverage.
- **Weather comparison feature depth:** multi-location side-by-side comparison view, backed by the `cached_weather` history table (§6.2).
- **Expanded historical replay range** (beyond the v1 default 7–30 day windows) for earthquakes and wildfires, leveraging USGS's and FIRMS's full historical archives.
- **Public "Data Sources" transparency page** made citable/linkable per layer (building on the v1 API status panel, FR-42) as a content/trust-building surface.
- **Additional locales** beyond the v1 three, prioritized by observed user geography.

## Version 3 — Platform expansion

- **Public API & SDK:** A rate-limited, API-keyed public REST API exposing Earth Live's *normalized* (not raw-upstream-passthrough, to respect each source's own terms of use) data — e.g., "current conditions + nearby events for a coordinate" as a single unified call, which is Earth Live's actual value-add over calling each upstream source individually. Ships with its own auth/CORS/rate-limit design distinct from the internal BFF (§10.6), and its own usage-based free/paid tier structure.
- **Browser extension:** A lightweight popup showing local live conditions (weather, nearby quakes, ISS pass times) without opening the full app — reuses the existing BFF endpoints.
- **Widgets:** OS-level widgets (see Mobile/Desktop below) surfacing the same lightweight local-conditions summary.
- **Deeper 3D Tiles content:** expanded city-scale 3D building coverage (beyond OSM-footprint extrusion) in select high-interest metro areas, contingent on finding additional free/open 3D Tiles-compatible datasets beyond OSM.

## Mobile apps

- **Approach:** React Native (or a Capacitor-wrapped web build as a faster-to-ship interim step) rather than fully separate native codebases, to maximize reuse of the existing TypeScript data layer (TanStack Query adapters, Zod schemas) between web and mobile.
- **Globe rendering on mobile:** Cesium for Unreal/Unity are not applicable here (this is a React Native context, not a game engine); the mobile app instead re-embeds the same CesiumJS web globe in a WebView for the core 3D experience initially, with a native-map (e.g., MapLibre Native, which has first-class iOS/Android SDKs) fallback/lite-mode for lower-end devices — mirroring the web app's CesiumJS-primary/MapLibre-secondary split (§3.2.3) rather than inventing a third rendering strategy.
- Push notifications (native, replacing/complementing web push) for the notification system in FR-32.

## Desktop apps

- Electron or Tauri wrapper around the existing web app for macOS/Windows/Linux, primarily for users who want an always-available "Earth Live" window/menu-bar presence rather than a fundamentally different experience — Tauri preferred if the smaller bundle size and lower resource footprint outweigh Electron's larger ecosystem maturity, evaluated at build time.

## Wear OS / Apple Watch

- Minimal, glanceable complications/tiles: current local conditions summary, nearest active alert (if a notification-worthy event is within the user's saved-location radius), ISS next-pass countdown — deliberately not an attempt to run the full globe experience on a watch face.

## Browser extension & widgets

- Covered under Version 3 above; called out again here per the roadmap structure requested — both are thin, read-only surfaces over the same BFF, not new backend capability.

## Public API & SDK

- Covered under Version 3 above. The SDK (thin TypeScript/JavaScript client wrapping the public API) ships alongside the API itself so third-party developers building on Earth Live's normalized data don't need to hand-roll HTTP calls against it.

## Sequencing rationale

The roadmap deliberately sequences **completeness and correctness of the free-data foundation (V1) before platform expansion (V3)** — a public API or mobile app built on top of a data layer that hasn't yet proven it can stay within every upstream free tier at real scale would just propagate scaling problems to more surfaces at once. V2 exists specifically to harden exactly that foundation using real v1 usage data before anything is built on top of it.
