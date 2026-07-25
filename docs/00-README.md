# Earth Live

**"The Earth, Live."**

Earth Live is an interactive, real-time visualization of everything happening on planet Earth right now — weather, earthquakes, volcanoes, wildfires, flights, ships, satellites, the ISS, aurora, solar activity, air quality, and ocean conditions — rendered on a navigable 3D digital-twin globe. Every value on screen is sourced from a free, publicly available, real-time (or near-real-time) API. There is no mock data, no placeholder content, and no AI in the product surface.

This directory is the complete software design document set for Earth Live. It is written to be handed directly to an engineering team with no additional discovery work required before sprint planning begins.

**This is the target design, not a status report.** For what's actually built, working, and verified right now — versus still planned — see [`TODO.md`](../TODO.md) at the project root. One deliberate deviation from this set: authentication (§2.2.15, §3.6) is out of scope for the current build by product decision — the app ships and runs fully anonymous, with no Auth.js implementation. Everything else in this design remains the intended target.

## How to read this set

Read in order for a first pass; use as reference thereafter.

| # | Document | Covers |
|---|----------|--------|
| 1 | [01-executive-summary.md](01-executive-summary.md) | What Earth Live is, why it exists, who it's for, success criteria |
| 2 | [02-product-requirements.md](02-product-requirements.md) | Features, layers, user flows, functional & non-functional requirements |
| 3 | [03-architecture.md](03-architecture.md) | System architecture, globe engine selection & rationale, infra topology |
| 4 | [04-ui-ux-spec.md](04-ui-ux-spec.md) | Visual language, layout system, components, responsive & accessibility spec |
| 5 | [05-api-integration-guide.md](05-api-integration-guide.md) | Every free data source: endpoints, auth, limits, caching, attribution |
| 6 | [06-database-design.md](06-database-design.md) | Full relational schema and relationships |
| 7 | [07-tech-stack.md](07-tech-stack.md) | Every library/framework choice and why, with package list |
| 8 | [08-deployment-guide.md](08-deployment-guide.md) | Environments, CI/CD, infrastructure, secrets |
| 9 | [09-performance-guide.md](09-performance-guide.md) | Performance budgets and the techniques used to hit them |
| 10 | [10-security-guide.md](10-security-guide.md) | OWASP-aligned threat model and controls |
| 11 | [11-roadmap.md](11-roadmap.md) | V1 → V3 and beyond (mobile, wearables, SDK, public API) |

## Non-negotiable product constraints

These constraints were set by the product owner and apply to every document in this set:

1. **No AI.** No LLM features, no AI-generated summaries, no chatbots, no ML-based prediction in v1.
2. **No mock data, ever.** Every number, icon state, and map layer must trace to a real, currently-live, free API response. If a feature cannot be built on free live data, the relevant document says so explicitly and names the closest free alternative (static dataset, community feed, or client-side computation).
3. **Free-tier-first.** Every third-party dependency in this document set has a free tier sufficient to run Earth Live at moderate scale. Paid tiers are noted only as future scaling options, never as a v1 requirement.
4. **Real GPS, not IP geolocation, as the primary location source**, with IP geolocation strictly as a fallback when the browser Geolocation API is denied or unavailable.

## Project tagline & positioning

Earth Live sits at the intersection of Google Earth (3D globe), FlightRadar24 (live flights), Windy (weather layers), NASA Eyes (space data), OpenStreetMap (base map data), and USGS earthquake monitoring — unified into one continuously live experience, not a static or replay-only visualization.

## Glossary

Terms used consistently across this document set, defined once here to avoid repetition:

- **Live** — data refreshed on an interval tied to how fast the underlying phenomenon actually changes (seconds to roughly one hour), per the liveness table in [05-api-integration-guide.md](05-api-integration-guide.md) §5.12.
- **Periodic** — data that updates on a slower, source-defined schedule (e.g., weekly volcano reports, daily satellite fire-detection passes) — genuinely refreshed, just not on a live cadence, and labeled as such in the UI (FR-15).
- **Static** — reference data that does not meaningfully change on any timescale relevant to the product (borders, elevation, airport locations) — periodically re-synced from source as a data-hygiene task, not because the underlying reality changed.
- **Adapter** — the server-side module responsible for calling one specific upstream API, normalizing its response, and reporting its health; see [03-architecture.md](03-architecture.md) §3.4.
- **BFF (Backend-for-Frontend)** — the Next.js Route Handler layer that sits between the client and all upstream APIs/the database; see [03-architecture.md](03-architecture.md) §3.1.
- **Cache-aside** — the pattern where a read checks Redis first, falls back to calling upstream on a miss, then writes the result back to Redis; see [03-architecture.md](03-architecture.md) §3.4.
- **Free-tier-first** — the product constraint that every dependency must run within its provider's free tier at v1 scale, with paid tiers noted only as explicit future scaling options; see §1 above.
