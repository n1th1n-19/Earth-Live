# 2. Product Requirements Document (PRD)

## 2.1 Goals

Earth Live must answer, at a glance and without any query, the question **"What is happening on Earth right now?"** — globally on first load, and hyper-locally once the user's position is known. Every requirement below is written against that goal.

## 2.2 Functional requirements

### 2.2.1 Core globe experience

- FR-1: Render an interactive 3D globe of Earth with satellite imagery, terrain elevation, and a real-time day/night terminator computed from current UTC time and solar position.
- FR-2: Support pan, zoom, tilt, and rotate via mouse, touch, and keyboard.
- FR-3: Support smooth "fly-to" camera animation to any coordinate, city, or bookmarked place.
- FR-4: Render cloud cover as a translucent, periodically-refreshed texture layer over the globe (sourced from live satellite/model data, not decorative).
- FR-5: Render city night lights as a static/periodic composite layer, explicitly labeled non-live (see [05-api-integration-guide.md](05-api-integration-guide.md) §Night Lights).

### 2.2.2 Location & personalization

- FR-6: On first visit, request browser Geolocation API permission with a clear, contextual prompt explaining why (to center the globe and show local conditions).
- FR-7: On grant, fly the camera to the user's coordinates and populate: current weather, day/night state, sunrise/sunset times, moon phase, local timezone, elevation, UV index, local AQI, nearby earthquakes (last 24h, configurable radius), nearby active wildfires, nearby airports, nearby weather stations, nearby live flights.
- FR-8: On denial or unavailability, fall back to IP-based geolocation (city-level accuracy) and clearly indicate to the user that location is approximate, with a one-click retry for precise GPS.
- FR-9: All "nearby" panels must re-query when the user's viewport center changes by more than a configurable threshold (default 50 km) or when the user explicitly re-centers on their location.
- FR-10: Persist the user's last camera position and active layers locally (and, if authenticated, server-side) so a returning visit resumes context instead of restarting at a default view.

### 2.2.3 Search

- FR-11: Global search bar (and command palette, see §2.2.9) resolves place names, coordinates (decimal and DMS), airport IATA/ICAO codes, and flight callsigns/ICAO24 identifiers.
- FR-12: Search results fly the camera to the resolved location and, where applicable (airports, flights), auto-enable the relevant layer.
- FR-13: Debounced autocomplete backed by a geocoding API (see [05-api-integration-guide.md](05-api-integration-guide.md) §Geocoding).

### 2.2.4 Layers

Earth Live ships the following toggleable layers at v1. Each layer's data source, refresh interval, and live/periodic/static status is fully specified in [05-api-integration-guide.md](05-api-integration-guide.md); this table is the product-level inventory.

| Layer | Category | Liveness |
|---|---|---|
| Temperature (2m) | Weather | Live (hourly model) |
| Wind (speed + direction, animated particles) | Weather | Live (hourly model) |
| Precipitation (rain) | Weather | Live (near-real-time radar/model) |
| Snow | Weather | Live (model) |
| Pressure (MSLP isobars) | Weather | Live (hourly model) |
| Humidity | Weather | Live (hourly model) |
| Radar (composite reflectivity, US) | Weather | Live (NWS, ~5–10 min) |
| Cloud cover | Weather | Live (hourly model / satellite) |
| Visibility | Weather | Live (hourly model) |
| Air Quality Index | Environment | Live (hourly) |
| UV Index | Environment | Live (hourly model) |
| Earthquakes | Geological | Live (USGS, ~1 min) |
| Volcanoes | Geological | Periodic (Smithsonian GVP weekly report) |
| Wildfires (active fire detections) | Geological/Environment | Live (NASA FIRMS, ~3 hr satellite pass) |
| Tropical cyclones / storm tracks | Weather | Live (NOAA NHC, active season only) |
| Lightning | Weather | Best-effort live (community network; see caveat in API guide) |
| ISS position | Space | Live (~5 s, computed) |
| Satellites (selectable catalog) | Space | Live (propagated from TLEs, updated daily) |
| Flights | Transportation | Live (OpenSky, ~10–15 s resolution) |
| Ships / marine traffic | Transportation | Best-effort live (community AIS feed; see caveat) |
| Country / admin borders | Reference | Static (vector dataset) |
| Roads | Reference | Static (OSM vector dataset) |
| 3D buildings | Reference | Static (OSM building footprints, extruded) |
| Population density | Reference | Static/periodic (published gridded dataset) |
| Night lights | Reference | Static/periodic (composite satellite imagery) |
| Terrain / elevation shading | Reference | Static (DEM, does not change) |
| Aurora forecast (Ovation) | Space weather | Live (NOAA SWPC, ~30–60 min) |
| Solar wind / Kp index | Space weather | Live (NOAA SWPC, ~1–5 min) |
| Ocean buoys (sea temp, wave height) | Marine | Live (NOAA NDBC, ~hourly) |

- FR-14: Layers are grouped into a collapsible layer panel with categories (Weather, Environment, Geological, Space, Transportation, Marine, Reference).
- FR-15: Each layer row shows a liveness badge ("Live", "Periodic", "Static") and last-updated timestamp.
- FR-16: Layer selection persists per session and, if authenticated, across sessions.

### 2.2.5 Event details & popups

- FR-17: Clicking/tapping any marker (earthquake, wildfire, flight, ship, volcano, ISS, satellite) opens a detail panel with the full attribute set returned by the source API (magnitude/depth for quakes, altitude/speed/origin-destination for flights, VIIRS/MODIS confidence for fire detections, etc.) and a link to the authoritative source page where the upstream API provides one.
- FR-18: Detail panels include a "Copy coordinates" and "Share location" action (see FR-27).

### 2.2.6 Bookmarks & saved places

- FR-19: Authenticated users can bookmark any coordinate or resolved place with a custom label.
- FR-20: Bookmarks are listed in a dedicated panel with one-click fly-to.
- FR-21: Anonymous users get the same functionality via local storage, with a prompt to create an account to sync across devices.

### 2.2.7 Measurement tool

- FR-22: A ruler tool measures great-circle distance and bearing between two or more clicked points, displayed in km/mi (user-configurable unit).
- FR-23: An area tool measures the enclosed area of a drawn polygon.

### 2.2.8 Coordinates & sharing

- FR-24: A persistent coordinate readout shows the current cursor/camera-center position in decimal degrees, with a click-to-copy in DMS format.
- FR-25: Every view state (camera position, zoom, active layers, selected event) is encodable into a shareable URL.
- FR-26: Opening a shared URL reproduces the exact view without requiring the recipient to have an account.
- FR-27: A "Share location" action generates the shareable URL and, where the Web Share API is available, opens the native share sheet.

### 2.2.9 Command palette & global search

- FR-28: A keyboard-invoked (`Cmd/Ctrl+K`) command palette provides fuzzy search across: places, saved bookmarks, layers (toggle by name), and app actions (settings, screenshot, fullscreen, replay).

### 2.2.10 Replay / historical playback

- FR-29: For layers with a queryable history (earthquakes, storms, wildfires), a replay control scrubs a time range (default last 7 days, configurable) and animates event occurrence over that window.
- FR-30: Replay is explicitly distinguished in the UI from the live view (a persistent "Replay Mode" banner) so users never mistake historical playback for current conditions.

### 2.2.11 Statistics dashboard

- FR-31: A dashboard view aggregates current global counts (active earthquakes ≥ M2.5 in last 24h, active wildfire detections, tracked flights, aurora Kp index, tropical cyclones active) with sparklines over the replay window.

### 2.2.12 Notifications

- FR-32: Authenticated users can subscribe to proximity alerts (e.g., "notify me of M4.5+ earthquakes within 200 km of my saved home location") delivered via in-app notification center and, if enabled, browser push notifications.
- FR-33: Notification preferences are per-saved-location and per-event-category.

### 2.2.13 Settings

- FR-34: Units (metric/imperial), theme (dark/light/system — dark is default), language, default layer set, notification preferences, and data-saver mode (reduces tile resolution and polling frequency) are all user-configurable and persisted.

### 2.2.14 Offline / degraded-network behavior

- FR-35: The app shell, last-known globe imagery tiles, and last-fetched layer data are cached (service worker) so a returning offline/poor-connectivity user sees a clearly-labeled "last known state" instead of a blank screen.
- FR-36: Any layer whose upstream API call fails shows an inline error state on that layer's panel row (not a global app error) and automatically retries with backoff.

### 2.2.15 Accounts & auth

- FR-37: Authentication is optional. Anonymous users get the full live-globe experience; only bookmarks-sync, notifications, and search history require an account.
- FR-38: Auth supports email/password and OAuth (Google, Apple) — see [03-architecture.md](03-architecture.md) §Auth.

### 2.2.16 Screenshots & fullscreen

- FR-39: A screenshot action captures the current globe canvas (plus optional UI chrome) as a downloadable PNG.
- FR-40: A fullscreen toggle uses the Fullscreen API for an immersive, chrome-free view.

### 2.2.17 Multi-language

- FR-41: UI strings are externalized for i18n from v1; initial shipped locales are English, Spanish, and French, with the framework in place to add more without code changes.

### 2.2.18 API status

- FR-42: A "Data Sources" panel lists every upstream API Earth Live depends on, its current health (derived from recent request success rate, not a synthetic status page), and a link to that source's own status page where one exists. This directly supports the "no mock data" trust principle — users can verify the app is truly live.

## 2.3 Non-functional requirements

- NFR-1: WCAG 2.1 AA conformance across all interactive elements (see [04-ui-ux-spec.md](04-ui-ux-spec.md) §Accessibility).
- NFR-2: Responsive from 320px-wide phones through ultra-wide (32:9) desktop monitors, and foldable-aware (layout adapts to a hinge/aspect-ratio change without reload).
- NFR-3: No upstream API's free-tier rate limit is ever exceeded under normal traffic; this is enforced by the caching/proxy layer described in [03-architecture.md](03-architecture.md), not by hoping client-side.
- NFR-4: Every upstream API's attribution requirement (where one exists) is satisfied in-product (footer/credits panel + per-layer attribution), per [05-api-integration-guide.md](05-api-integration-guide.md).
- NFR-5: The app must degrade gracefully layer-by-layer; no single upstream outage takes down the shell or unrelated layers.

## 2.4 User flows

### 2.4.1 First visit

1. User lands on the app; globe renders at a default global view (e.g., centered on 20°N with a wide zoom) using cached/default imagery while live layers begin loading.
2. A non-blocking toast/prompt requests geolocation permission with a one-line rationale.
3a. **Grant path:** Browser returns coordinates → camera flies to location (2–3s eased animation) → local weather, day/night, sunrise/sunset, moon phase, timezone, elevation, UV, AQI, nearby quakes/wildfires/airports/flights populate into the side panel as each API resolves (progressive, not blocking on the slowest one).
3b. **Deny/unavailable path:** App calls IP-geolocation fallback → same population as above, but every localized panel is prefixed with an "approximate location" indicator and a "Use precise location" button that re-triggers the Geolocation API prompt.
4. Default layer set (Temperature, Clouds, Earthquakes, Flights) is enabled; the layer panel is visible but collapsible.
5. A brief, dismissible onboarding overlay highlights the command palette shortcut, layer panel, and search bar. Shown once (tracked via local storage / account preference).

### 2.4.2 Returning visitor

1. If authenticated or if local storage has a prior session, the app restores last camera position, active layers, and units — skipping the default global view.
2. Geolocation is re-requested only if the browser permission is still granted (silent) or if the user's saved "home" location has gone stale (> 30 days) — otherwise the app trusts the restored state and refreshes live layer data for that view immediately.

### 2.4.3 Searching

1. User opens command palette or clicks the search bar.
2. Types a query; debounced (250ms) requests hit the geocoding endpoint and, in parallel, fuzzy-match against bookmarks/layers/actions.
3. Results are grouped (Places, Bookmarks, Layers, Actions) with keyboard navigation.
4. Selecting a place result flies the camera and closes the palette; selecting a layer action toggles that layer without navigating.

### 2.4.4 Viewing an event

1. User clicks/taps a marker (e.g., an earthquake epicenter).
2. A detail panel slides in (side panel on desktop/tablet, bottom sheet on mobile) showing full event attributes, a mini-map thumbnail, and source attribution/link.
3. User can bookmark the location, share it, or dismiss the panel to return to the free globe view.

### 2.4.5 Bookmarking

1. From a detail panel or by long-press/right-click on any globe point, user selects "Bookmark this location."
2. If anonymous, saved to local storage immediately with a subtle "Sign in to sync across devices" nudge (non-blocking).
3. If authenticated, persisted via API to the `bookmarks` table (see [06-database-design.md](06-database-design.md)) and available in the Bookmarks panel instantly (optimistic UI) with server confirmation.

### 2.4.6 Replay

1. User opens Replay mode from the toolbar.
2. A time-range scrubber appears (default: last 7 days); live layers pause and switch to their historical-query variant where the source API supports it (USGS earthquake feeds, NOAA storm archives, FIRMS archive).
3. User drags the scrubber or presses play to animate; a persistent banner reads "Replay Mode — not live" to prevent confusion.
4. Exiting Replay mode instantly restores the live view and un-pauses polling.

### 2.4.7 Settings

1. User opens Settings from the command palette or a persistent gear icon.
2. Changes are applied live (no "Save" button required) and persisted to local storage immediately; if authenticated, synced to the `preferences` table in the background.

### 2.4.8 Offline / connectivity loss

1. Service worker detects a failed network request for a live-data endpoint.
2. The affected layer's UI shows a small "offline — showing last known data from {timestamp}" badge rather than blank/error state.
3. On reconnect, the layer silently refreshes and the badge disappears.

### 2.4.9 Error states

1. **Upstream API down:** Layer-level error badge, automatic exponential-backoff retry, no blocking of the rest of the app.
2. **Geolocation denied:** Handled per §2.4.1 (fallback to IP location, not a hard error).
3. **Invalid search query:** Empty-state message with a suggestion to try a coordinate pair or place name.
4. **Rate-limited by our own backend (abuse protection):** A clear, friendly rate-limit message with a retry-after countdown — never a silent failure.

## 2.5 Out of scope for v1

- Any AI/ML feature (explicitly excluded per product constraint).
- Real-time global AIS ship tracking at FlightRadar24-equivalent fidelity (no free tier provides this; see [05-api-integration-guide.md](05-api-integration-guide.md) §Marine Traffic for the best-effort free alternative and its limits).
- Paid/commercial-grade lightning detection network data.
- Native mobile/desktop/wearable apps (roadmapped — see [11-roadmap.md](11-roadmap.md)).
