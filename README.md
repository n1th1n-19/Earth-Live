# Earth Live

**"The Earth, Live."**

An interactive 3D globe showing real-time weather, earthquakes, wildfires, flights, the ISS, air quality, and space weather — every value on screen traces to a free, live, public API. No mock data, no AI, no auth required.

Full design spec: [`docs/`](docs/00-README.md). Current build status (what's actually done vs. still planned): [`TODO.md`](TODO.md).

## What's live right now

- 3D CesiumJS globe with real-time day/night terminator, your GPS location (or IP fallback)
- Live weather, sunrise/sunset, moon phase, air quality, timezone for wherever you are
- Live earthquakes (USGS), wildfires (NASA FIRMS), flights (OpenSky), the ISS moving via real orbital mechanics (CelesTrak + SGP4)
- Live Kp geomagnetic index + NASA space weather notifications
- Command palette with live place search (Nominatim), bookmarks, measurement tool, screenshot/fullscreen
- Replay mode — scrubs real earthquake history the app has been accumulating in its own database
- Settings (units), stats dashboard (live counts), consolidated data-source credits, shareable view-state URLs

See [`docs/05-api-integration-guide.md`](docs/05-api-integration-guide.md) for every data source, its rate limits, caching, and attribution requirements.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the keys you have — see below
npm run dev                  # http://localhost:3081
```

`npm install` runs `prisma generate` automatically (no live database needed for that step).

### Environment variables

All documented in [`.env.example`](.env.example). Nothing is required to run the app locally — every adapter degrades gracefully without its key (cache falls back to in-memory without Redis, and the four keyed adapters below simply won't work until configured):

| Variable | Needed for | Get it from |
|---|---|---|
| `DATABASE_URL` | Replay mode, Prisma schema | [neon.tech](https://neon.tech) (or Vercel Marketplace) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Shared cache + rate limiting | [upstash.com](https://upstash.com) (or Vercel Marketplace) |
| `FIRMS_MAP_KEY` | Wildfires layer | `firms.modaps.eosdis.nasa.gov/api/map_key` |
| `NASA_API_KEY` | Space weather notifications | `api.nasa.gov` |
| `OPENAQ_API_KEY` | Air quality panel | `explore.openaq.org` |
| `GEONAMES_USERNAME` | Timezone lookup | `geonames.org` (enable "Free Web Services" in account settings) |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | Currently unused — the globe is a wireframe look (no imagery/terrain provider); kept in `.env.example` in case that changes | `ion.cesium.com` |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Error tracking (optional) | `sentry.io` |

Auth env vars exist in `.env.example` for schema completeness but auth is **out of scope for this build** — the whole app works anonymously.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 3081 |
| `npm run build` | Production build |
| `npm test` | Vitest — adapter normalization + geo-math + SGP4 propagation tests |
| `npm run lint` | ESLint |
| `npx prisma migrate dev` | Apply schema to `DATABASE_URL` |

## Stack

Next.js 16 (App Router) · CesiumJS/Resium · TanStack Query · Zustand · Prisma + Neon Postgres (PostGIS) · Upstash Redis · Tailwind · Sentry. Full rationale for every choice: [`docs/07-tech-stack.md`](docs/07-tech-stack.md).

## Docs

- [`docs/00-README.md`](docs/00-README.md) — index of the full design doc set (architecture, UI/UX spec, API guide, DB schema, security, roadmap)
- [`TODO.md`](TODO.md) — the honest, currently-accurate build checklist: what's done, what's stubbed, what's genuinely blocked and why
