# 7. Technology Stack

Every choice below is justified against the specific constraints of this product: heavy WebGL rendering, ~20 independent free-API integrations, free-tier-first infrastructure, and a premium, accessible UI. "Because it's popular" is never sufficient justification on its own below — each entry ties back to a concrete requirement.

## 7.1 Frontend

| Package | Role | Why |
|---|---|---|
| `next` | Application framework | App Router gives Server Components for the static shell/SEO surfaces and Client Components for the WebGL globe, with Fluid-Compute-backed API routes doubling as the BFF layer — one framework covers both frontend and backend per [03-architecture.md](03-architecture.md). |
| `react`, `react-dom` | UI library | Required by Next.js; React 19's concurrent features help keep the globe's canvas responsive while data panels stream in. |
| `cesium` | 3D globe engine | Primary rendering engine — full rationale in [03-architecture.md](03-architecture.md) §3.2. |
| `resium` | React bindings for Cesium | Declarative React wrapper over Cesium's imperative API, avoiding hand-rolled lifecycle glue between React's render cycle and Cesium's scene graph. |
| `maplibre-gl` | 2D map renderer | Secondary renderer for minimap/measurement/lite-mode contexts — rationale in [03-architecture.md](03-architecture.md) §3.2.3. |
| `react-map-gl` (MapLibre-compatible fork) | React bindings for MapLibre | Same rationale as `resium`, for the MapLibre surfaces. |
| `@tanstack/react-query` | Server-state management | Purpose-built for exactly this app's core data problem — many independently-cached, independently-polled remote resources with per-source stale/refetch tuning (§3.3). Avoids hand-rolling cache invalidation, dedup, and background refetch. |
| `zustand` | Client UI state | Minimal, un-opinionated store for ephemeral UI state (panel open/closed, active layer toggles) — deliberately lighter than Redux since this state doesn't need time-travel debugging or middleware chains, just fast, simple reactivity. |
| `framer-motion` | Animation | Spring-physics-based transitions for panels/sheets/command palette per [04-ui-ux-spec.md](04-ui-ux-spec.md) §4.2 — chosen over CSS-only transitions because interruptible, physically-natural spring motion (e.g., a bottom sheet drag that can be flung or released mid-gesture) needs a JS animation engine, not just keyframes. |
| `tailwindcss` | Styling | Utility-first CSS keeps the glass-panel/dark-mode design system consistent and themeable (CSS variables + Tailwind's dark-mode variant) without a runtime CSS-in-JS cost on a performance-sensitive, WebGL-heavy page. |
| `shadcn/ui` (Radix UI primitives + Tailwind) | Component primitives | Unstyled, accessible (WAI-ARIA-compliant) primitives for dialogs, popovers, command palette, and sheets — gives WCAG AA behavior (focus trapping, keyboard nav) for free rather than reimplementing it, directly supporting NFR-1. |
| `cmdk` | Command palette | Purpose-built, accessible fuzzy-command-palette primitive (the same one used by Linear/Vercel-style products) — directly implements FR-28 rather than building fuzzy search + keyboard nav from scratch. |
| `lucide-react` | Icon set | Single consistent icon family per [04-ui-ux-spec.md](04-ui-ux-spec.md) §4.2, tree-shakeable SVG icons. |
| `recharts` | Charts (statistics dashboard, sparklines) | Declarative, React-native charting sufficient for the dashboard's stat tiles/sparklines (FR-31) without pulling in a heavier general-purpose viz library the app doesn't otherwise need. |
| `satellite.js` | SGP4 orbital propagation | Computes live satellite/ISS positions client-side from CelesTrak TLEs (§5.4) — the correct, standard, MIT-licensed library for this exact math, avoiding a from-scratch orbital-mechanics implementation. |
| `suncalc` | Sun/moon position & phase | Client-side, zero-API-call computation of moon phase and precise sun position, per the explicit no-free-API decision in [05-api-integration-guide.md](05-api-integration-guide.md) §5.8. |
| `next-intl` | i18n | Type-safe, App-Router-native internationalization for FR-41's multi-language requirement. |
| `zod` | Runtime schema validation | Validates every normalized upstream-API response shape at the adapter boundary (§3.4) and every client→BFF request payload — catches upstream schema drift immediately instead of it silently corrupting the UI. |

## 7.2 Backend

| Package | Role | Why |
|---|---|---|
| Next.js Route Handlers (Fluid Compute) | BFF / API gateway | See [03-architecture.md](03-architecture.md) §3.4 — one deployable, warm-instance reuse for the many thin proxy/cache-lookup endpoints this app is mostly made of. |
| `@auth/core` / `next-auth` (Auth.js) | Authentication | Credentials + OAuth (Google, Apple) providers, JWT sessions, first-class Next.js integration — avoids building session/cookie/CSRF handling from scratch. |
| `@node-rs/argon2` | Password hashing | Argon2id is the current OWASP-recommended password-hashing algorithm (over bcrypt) for new systems — directly supports [10-security-guide.md](10-security-guide.md). |
| `@upstash/redis` | Redis client | HTTP-based Redis client purpose-built for serverless/edge environments (no persistent TCP connection required), matching Upstash's serverless-friendly free tier chosen in [03-architecture.md](03-architecture.md) §3.5. |
| `@upstash/ratelimit` | Rate limiting | Redis-backed sliding-window rate limiter, directly implementing the abuse-prevention requirement in [03-architecture.md](03-architecture.md) §3.8 and [10-security-guide.md](10-security-guide.md). |
| `prisma` / `@prisma/client` | ORM & migrations | Type-safe query building matching the TypeScript-first stack; first-class migration tooling for the schema in [06-database-design.md](06-database-design.md); works cleanly with Neon's serverless Postgres via its driver adapter. |
| `@neondatabase/serverless` | Postgres driver | Neon's HTTP/WebSocket-based driver, required for reliable Postgres access from serverless/edge-adjacent Fluid Compute functions without connection-pool exhaustion. |
| `fast-xml-parser` | XML parsing | Several upstream sources (NHC GIS feeds, GDACS RSS, NDBC text) require XML/text parsing server-side inside the adapter layer before normalizing to JSON. |
| `p-queue` | Concurrency control | Bounds concurrent outbound requests within background ingestion jobs (e.g., the OSM/OurAirports bulk-sync jobs) so a scheduled job doesn't itself spike an upstream source's rate limit. |

## 7.3 Testing & quality

| Package | Role | Why |
|---|---|---|
| `vitest` | Unit/integration testing | Fast, Vite-native test runner with Jest-compatible API — used for adapter normalization logic, spatial-query helpers, and orbital-propagation math, where correctness (e.g., "does this adapter correctly parse a USGS GeoJSON feature") is easy to pin down with fixtures. |
| `@testing-library/react` | Component testing | Tests UI behavior (panel open/close, command palette filtering) from the user's perspective rather than implementation details. |
| `playwright` | End-to-end testing | Cross-browser E2E covering the critical flows in [02-product-requirements.md](02-product-requirements.md) §2.4 (first visit → geolocation → localized data population; search → fly-to; bookmark → persist). Chosen over Cypress for genuine multi-browser (including WebKit) coverage, relevant since Safari/iOS WebGL behavior is a real risk area for a Cesium-heavy app. |
| `eslint` + `@typescript-eslint` | Linting | Standard TypeScript linting; a custom rule set enforces that no raw upstream API URL is called from a Client Component (all upstream calls must go through a server-side adapter, per [10-security-guide.md](10-security-guide.md) key-handling requirements). |
| `prettier` | Formatting | Consistent formatting, run in CI and via a pre-commit hook. |
| `typescript` | Type system | End-to-end type safety from Prisma-generated DB types through Zod-validated API responses to React props — critical in a codebase with ~20 differently-shaped external data sources where type drift is the most likely source of bugs. |

## 7.4 CI/CD & deployment

| Tool | Role | Why |
|---|---|---|
| GitHub Actions | CI | Lint, typecheck, unit/integration tests, and Playwright E2E on every PR; a separate scheduled workflow runs a "canary" check against each upstream API's adapter to catch upstream schema drift before it reaches users (complements the runtime health-tracking in §3.4). |
| Vercel | Hosting & CD | Native Next.js deployment target, preview deployments per PR (paired with Neon's branch-per-preview database feature), Fluid Compute runtime, Edge Network CDN, and built-in analytics/observability — one platform covering hosting, CDN, compute, and CD per [08-deployment-guide.md](08-deployment-guide.md). |
| Sentry | Error tracking | Frontend + backend exception capture, release tracking tied to CI deploys — see [03-architecture.md](03-architecture.md) §3.7. |

## 7.5 Monitoring, logging, analytics

| Tool | Role | Why |
|---|---|---|
| Vercel Observability / log drains | Request & function logging | Native to the hosting platform, captures every Route Handler invocation including the structured `api_logs`-feeding data. |
| Sentry Performance | Tracing | Traces slow adapter calls and Cesium scene-update long-tasks, feeding the performance budget in [09-performance-guide.md](09-performance-guide.md). |
| Privacy-respecting analytics (e.g., Vercel Analytics) | Product analytics | Cookieless, no third-party ad-tech — aligns with the product's positioning as a trustworthy, transparent window onto public data (no user-tracking irony undermining that trust). |

## 7.6 Notable exclusions and why

- **No GraphQL layer.** The app's data-fetching pattern is "many independently-cacheable REST-shaped resources," which TanStack Query + typed REST Route Handlers already model cleanly; a GraphQL gateway would add a resolver/schema layer with no clear win over the existing per-source adapter model.
- **No Redux.** Zustand covers the app's actual UI-state complexity; Redux's boilerplate and middleware ecosystem aren't earned here (TanStack Query already owns server state, which is where Redux-plus-thunks complexity usually accumulates in data-heavy apps).
- **No Mapbox GL JS.** Proprietary/paid above a free usage tier since the v2 license change — disqualified by the free-tier-first constraint; MapLibre GL JS is the direct permissively-licensed substitute (§3.2.1).
- **No client-side ORM/database.** All persistence goes through the BFF to Postgres/Redis; no IndexedDB-backed local database beyond the service worker's cache storage (§ offline behavior, FR-35), since the app's offline requirement is "show last-known state," not "function as a local-first app."
