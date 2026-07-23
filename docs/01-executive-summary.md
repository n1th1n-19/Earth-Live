# 1. Executive Summary

## 1.1 What Earth Live is

Earth Live is a web application that renders a live, navigable 3D model of Earth and overlays it with real-time environmental, geological, atmospheric, and transportation data pulled directly from free, public APIs operated by government agencies (NOAA, USGS, NASA, NWS), scientific consortia (Smithsonian, Copernicus), and open community projects (OpenStreetMap, OpenSky Network, CelesTrak). A user opens the app, grants (or declines) location access, and is immediately flown to their position on a globe showing current weather, day/night terminator, nearby earthquakes, active wildfires, live aircraft, the International Space Station, and dozens of other live layers — all continuously refreshing without a page reload.

There is no synthetic data anywhere in the product. Every pixel of "live" information — a storm cell, a flight icon, a quake marker, a cloud layer — is a direct rendering of a real API response, cached only long enough to respect upstream rate limits.

## 1.2 Why it exists

Several excellent single-domain tools already exist — FlightRadar24 for aviation, Windy for weather, USGS's own earthquake map, NASA Eyes for space assets — but no free, ad-light product unifies them into one continuously-live globe with a shared camera, shared search, and shared "what's near me" context. Earth Live's thesis is that the value is in the *synthesis*: seeing that a wildfire, a heatwave, and a poor-AQI reading are co-located, or that an incoming storm system will cross a flight corridor, requires one coherent view rather than five browser tabs.

## 1.3 Who it's for

- **Curious general users** who want a "what's happening on Earth right now" home page — the target for the emotional hook of the product.
- **Aviation and weather enthusiasts** who currently stitch together FlightRadar24, Windy, and NOAA radar manually.
- **Journalists and researchers** who need a fast, sourced, citable view of a live event (an earthquake swarm, a wildfire complex, a cyclone track).
- **Educators** teaching geography, earth science, or civics, who need a real-time, zero-cost teaching aid.

Earth Live is explicitly **not** targeting professional dispatch, emergency-management, or trading use cases in v1 — those require SLAs and paid data feeds this document does not assume.

## 1.4 Product pillars

1. **Live, not static.** Every layer polls or streams from source on an interval appropriate to how fast that data actually changes (seconds for ISS position, minutes for flights, tens of minutes for weather, hours for wildfire detections).
2. **Real location, real context.** Browser Geolocation API first, IP-based geolocation only as a denied-permission fallback, and every "nearby" panel (weather, quakes, flights, air quality) is computed from the user's actual coordinates.
3. **Zero cost to run at moderate scale.** Every chosen API has a free tier; see [05-api-integration-guide.md](05-api-integration-guide.md) for the full accounting of limits and how the caching layer stays under them.
4. **No AI, ever, in v1.** This is a stated constraint, not an oversight — the product's credibility comes from being a direct window onto verifiable public data, not an interpretation of it.
5. **Premium, uncluttered UI.** Dark-mode-first, glass-panel, command-palette-driven interface comparable in polish to Linear, Arc, and FlightRadar24 — see [04-ui-ux-spec.md](04-ui-ux-spec.md).

## 1.5 Success criteria (v1)

| Metric | Target |
|---|---|
| Time to first meaningful paint of the globe | < 2.5s on a median mobile connection (4G, mid-tier device) |
| Time from geolocation grant to localized data fully populated | < 3s |
| Globe frame rate during camera movement | ≥ 55 FPS on a 2021-era laptop GPU, ≥ 30 FPS on a mid-tier phone |
| Lighthouse Performance score | ≥ 90 |
| Lighthouse Accessibility score | ≥ 95 (WCAG AA conformance) |
| Layers backed by genuinely live (≤ 1 hour staleness) data | 100% of layers marketed as "live"; layers that cannot be live are explicitly labeled "periodic" or "static" in the UI |
| Uptime of the app shell (independent of any single upstream API being down) | 99.9% — a single dead upstream API degrades one layer, never the app |

## 1.6 Key risks and how this document set addresses them

| Risk | Mitigation, documented where |
|---|---|
| A free upstream API changes its response shape or is retired | Per-source adapter isolation and a scheduled CI canary check ([03-architecture.md](03-architecture.md) §3.4, [08-deployment-guide.md](08-deployment-guide.md) §8.2) catch this before it reaches users; each layer degrades independently (NFR-5). |
| Earth Live's own traffic growth exceeds an upstream free-tier rate limit | The cache-aside + SSE fan-out architecture decouples upstream call volume from concurrent user count ([03-architecture.md](03-architecture.md) §3.9) — this is the central scaling property the whole backend is designed around, not an afterthought. |
| A "live" claim turns out to be unverifiable or misleading to users | Every layer carries an explicit liveness badge (Live/Periodic/Static, FR-15) and the API Status panel (FR-42) makes sourcing inspectable by any user — the product treats honesty about data freshness as a feature, not a caveat to hide. |
| Team builds toward a globe engine that can't deliver required features | The engine decision was made by comparing five real candidates against the product's actual feature list, not by default familiarity — full comparison and decision rationale in [03-architecture.md](03-architecture.md) §3.2. |
| Scope creep toward AI features | Explicitly and repeatedly excluded as a v1 and v2 constraint (§1.4, [11-roadmap.md](11-roadmap.md)); revisiting this requires a deliberate product decision, not an incidental engineering addition. |

## 1.7 What this document set contains

The remaining eleven documents in this set ([00-README.md](00-README.md) indexes them) constitute a complete, buildable specification: product requirements and every user flow, the system architecture and the reasoning behind the 3D globe engine selection, the full UI/UX specification, a data-source-by-data-source integration guide naming every free API endpoint and its limits, the relational database schema, the complete technology stack with rationale, deployment and CI/CD design, performance budget and techniques, a security threat model, and a three-version roadmap through mobile and wearable clients.
