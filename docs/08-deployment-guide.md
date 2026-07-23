# 8. Deployment Guide

## 8.1 Environments

| Environment | Purpose | Database | Notes |
|---|---|---|---|
| Local dev | Individual development | Local Postgres via Docker, or a personal Neon branch | Redis via a local Docker container or a personal Upstash free-tier database; `.env.local` holds all upstream API keys (never committed). |
| Preview | Per-PR review | Ephemeral Neon database branch, created automatically per PR | Vercel Preview Deployment per push; branch is destroyed when the PR closes, giving each PR a fully isolated, disposable database. |
| Staging | Pre-production integration testing | Long-lived Neon branch | Mirrors production configuration; used for manual QA and for the scheduled upstream-adapter canary checks (§7.4) before they run against production. |
| Production | Live app | Primary Neon branch | Vercel Production Deployment, custom domain, all monitoring/alerting active. |

## 8.2 CI/CD pipeline

1. **On pull request:** GitHub Actions runs lint → typecheck → unit/integration tests (Vitest) → build → Playwright E2E against a preview deployment. Vercel simultaneously builds a Preview Deployment with an auto-provisioned Neon database branch (schema migrated automatically via a Prisma migrate step in the build).
2. **On merge to `main`:** The same checks re-run against `main`, then Vercel promotes a Production Deployment. Prisma migrations run as a distinct, explicit deploy step (`prisma migrate deploy`) **before** the new application code goes live, never implicitly — schema changes are reviewed in the PR diff like any other code change.
3. **Rollback:** Vercel's instant-rollback-to-previous-deployment capability is the primary rollback mechanism for application code. Database migrations are written to be backward-compatible for at least one deploy cycle (additive-first: add nullable columns/new tables before removing old ones in a later deploy) so a code rollback never requires an accompanying destructive database rollback.
4. **Scheduled canary workflow:** A separate, time-triggered GitHub Actions workflow (independent of any code push) calls each upstream adapter in [05-api-integration-guide.md](05-api-integration-guide.md) against staging and diff-checks the normalized shape against a stored fixture, catching upstream API schema drift proactively rather than via a user-facing bug report.

## 8.3 Infrastructure summary

- **Compute:** Vercel Fluid Compute (Node.js 24 LTS) for all Route Handlers, Middleware, and background jobs.
- **Scheduled jobs:** Vercel Cron for lightweight periodic tasks (cache pre-warming, notification-matching sweep); Vercel Queues for anything with meaningful processing time or that needs durable at-least-once delivery (e.g., the bulk OSM/OurAirports re-sync jobs, §5.5/5.6).
- **CDN/Edge:** Vercel Edge Network serves static assets and edge-cached proxy responses.
- **Cache:** Upstash Redis (serverless, HTTP-based — no persistent connection pool to manage from Fluid Compute functions).
- **Database:** Neon serverless Postgres, with PostGIS enabled (§6.4), branch-per-preview-environment.
- **DNS/domain:** Managed through Vercel's domain configuration; production domain fronted by Vercel's platform-level TLS.
- **Secrets:** All third-party API keys (FIRMS `MAP_KEY`, NASA API key, OpenAQ key, GeoNames username, OAuth client secrets, Auth.js secret) stored as Vercel encrypted environment variables, scoped per environment (a staging OpenAQ key is distinct from production, so a leaked staging key can be rotated without a production incident) — never committed to the repository, never present in any client-side bundle (enforced by the ESLint rule in [07-tech-stack.md](07-tech-stack.md) §7.3 requiring all upstream calls to route through server-side adapters).

## 8.4 Edge vs. origin split

- **At the edge (CDN):** Static app shell assets, globe imagery/terrain tile requests proxied through Earth Live's own domain (cached aggressively — tiles for a given coordinate/zoom are immutable for their cache lifetime), and any response explicitly marked cacheable with a long `s-maxage` (e.g., geocoding results, airport reference data).
- **At origin (Fluid Compute):** Anything requiring a secret key, anything requiring Redis/Postgres access, all authenticated requests, and all short-TTL live-data proxying (weather, quakes, flights, etc.) where the cache-aside logic itself lives.

## 8.5 Feature flags & gradual rollout

New layers or experimental features (e.g., a not-yet-secured Ships/AIS layer per [05-api-integration-guide.md](05-api-integration-guide.md) §5.7) are gated behind a simple environment-variable/database-backed feature flag rather than a full flagging platform for v1 — sufficient given the team's scale, with Vercel's Rolling Releases (gradual/canary deployment percentage rollout) used for riskier changes (e.g., a Cesium version upgrade) to catch regressions against a small percentage of production traffic before a full rollout.

## 8.6 Disaster recovery

- **Database:** Neon's point-in-time recovery covers accidental data loss; daily automated backups retained per Neon's plan defaults.
- **Total upstream-API outage (any single source):** By design (§3.4, §5.12), this degrades exactly one layer, shown with the inline error/stale-data state from FR-36 — never an app-wide incident.
- **Total Redis outage:** Adapters fall back to calling upstream directly (bypassing cache-aside) with a tightened per-source concurrency limit to avoid an upstream rate-limit breach during the outage window — a deliberate degraded-but-functional mode rather than a hard app failure.
- **Vercel platform outage:** Outside Earth Live's control; status communicated via the app's own status page (a simple static page hosted independently, e.g., on a separate low-dependency host, so it remains reachable even if the primary deployment is down).
