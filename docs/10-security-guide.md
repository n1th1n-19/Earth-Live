# 10. Security Guide

## 10.1 Threat model summary

Earth Live's attack surface is dominated by two things: it proxies ~20 third-party API keys, and it accepts precise user location data. The security posture below is built around protecting those two assets, plus standard web-application hardening.

## 10.2 OWASP Top 10 mapping

| Risk | Control |
|---|---|
| **A01 Broken Access Control** | All user-owned resources (bookmarks, saved_locations, notifications, preferences) are scoped by `user_id` at the query layer via Prisma, never trusted from client-supplied IDs alone — every mutation re-derives ownership server-side from the authenticated session, not from a request body field. |
| **A02 Cryptographic Failures** | Passwords hashed with argon2id (§7.2); all traffic TLS-only (enforced via HSTS); session tokens are high-entropy opaque values, not predictable/sequential. |
| **A03 Injection** | Prisma's parameterized queries eliminate SQL injection by construction; all upstream-derived data rendered in the UI is treated as untrusted text (React's default JSX escaping prevents stored/reflected XSS from a malicious upstream field, e.g. a crafted flight callsign or place name). |
| **A04 Insecure Design** | Optional-auth-by-design (§2.2.15) minimizes the amount of sensitive data the system holds at all; the cache-aside/adapter pattern (§3.4) isolates blast radius of any single upstream compromise or schema anomaly. |
| **A05 Security Misconfiguration** | Strict CSP (§10.3), no verbose error responses in production (Sentry captures full detail server-side; the client sees a generic error), dependency-update automation (Dependabot/Renovate) against the package list in [07-tech-stack.md](07-tech-stack.md). |
| **A06 Vulnerable & Outdated Components** | Automated dependency-update PRs with CI gating (§8.2) before merge; Cesium and MapLibre versions tracked deliberately given their large attack surface (WebGL, tile parsing) and update cadence. |
| **A07 Identification & Authentication Failures** | Auth.js-managed sessions, argon2id hashing, OAuth delegated to Google/Apple for those flows (no password handling for OAuth users), rate-limited login attempts (§10.4). |
| **A08 Software & Data Integrity Failures** | CI-verified builds only reach production (§8.2); no runtime dependency fetching from unpinned sources; Subresource Integrity is not applicable to same-origin bundled assets but is considered for any future third-party script inclusion. |
| **A09 Security Logging & Monitoring Failures** | `api_logs` (§6.2) plus Sentry give both business-level (upstream failure patterns) and security-relevant (auth failures, rate-limit trips) visibility; alerting configured for anomalous spikes in auth failures or rate-limit rejections. |
| **A10 Server-Side Request Forgery (SSRF)** | Every server-side outbound request target is a **fixed, hardcoded upstream base URL** per adapter (§5, §3.4) — never a user-supplied URL — eliminating the class of SSRF where user input controls an internal fetch target. |

## 10.3 Content Security Policy

A strict CSP is applied via response headers:

- `default-src 'self'`
- `connect-src 'self' <Cesium ion asset endpoints> <self-hosted tile origin>` — no wildcard; every allowed connection target is enumerated, consistent with all upstream calls being server-proxied rather than client-direct (§10.5) except where a client-side Cesium ion asset stream is unavoidable (terrain/imagery tile fetches, which don't carry the app's own secret keys — Cesium ion access tokens are scoped, low-privilege, and safe for client exposure by design, unlike the FIRMS/NASA/OpenAQ/GeoNames keys which are never sent to the client).
- `script-src 'self'` (no inline scripts; Next.js's built-in nonce-based handling covers any framework-injected inline script needs).
- `img-src 'self' data: blob: <tile/imagery origins>`.
- `frame-ancestors 'none'` (prevents clickjacking — the app should never be embedded in a third-party iframe).
- `object-src 'none'`.

## 10.4 Rate limiting & abuse prevention

- **Per-IP and per-user sliding-window limits** (Upstash-backed, §7.2) on all mutating endpoints (bookmark creation, auth attempts) and on search/geocoding proxy endpoints specifically, since those are the endpoints most directly exposing an upstream free-tier quota (Nominatim's 1 req/s ceiling, §5.5) to abuse.
- **Vercel BotID** at the platform edge filters automated/bot traffic before it reaches application rate-limit logic, reducing load on the Redis-backed limiter itself.
- **Auth-specific throttling:** Login attempts are rate-limited per email and per IP independently (protects against both credential-stuffing-by-IP and distributed low-and-slow attacks against a single account).
- **CAPTCHA/challenge:** Reserved as a fallback control (not enabled by default in v1) for account creation/login if abuse patterns emerge post-launch, rather than imposed on all users pre-emptively.

## 10.5 Secrets & API key handling

- Every third-party credential in [05-api-integration-guide.md](05-api-integration-guide.md) that requires a key (FIRMS `MAP_KEY`, NASA API key, OpenAQ key, GeoNames username, OAuth client secrets) is stored as an environment variable in Vercel, scoped per environment (§8.3), and read only server-side.
- **No secret is ever included in a client bundle.** This is enforced both by convention (all upstream calls route through server-side adapters, never client-side `fetch` to a keyed endpoint) and mechanically (the custom ESLint rule referenced in [07-tech-stack.md](07-tech-stack.md) §7.3 that flags any direct client-side import of an adapter module or raw upstream URL containing a key placeholder).
- Key-free public sources (Open-Meteo, USGS, Open-Notify, sunrise-sunset.org, REST Countries, CelesTrak) are still proxied server-side uniformly (§3.8) — not for secrecy, but so caching/rate-limiting/logging apply consistently and so a future switch to a keyed tier of any of these doesn't require a client-side change.
- Secrets rotation: each key is independently rotatable without a full redeploy (env var change + instant redeploy on Vercel), and staging/production keys are distinct (§8.3) so a staging leak never requires rotating the production credential.

## 10.6 CORS

- The BFF's API routes accept requests only from Earth Live's own origin(s) (production domain + preview-deployment wildcard pattern for CI/QA) — there is no public, cross-origin-callable API surface in v1 (a public API is explicitly a later-roadmap item, [11-roadmap.md](11-roadmap.md), which will get its own dedicated auth/CORS/rate-limit design when built, distinct from the internal BFF).

## 10.7 Location data handling

- Precise GPS coordinates obtained via the browser Geolocation API are used to drive UI state and outbound queries to upstream APIs (weather-by-coordinate, nearby-quakes, etc.) — **never persisted to the database** unless the user explicitly creates a bookmark or saved location from that position (an intentional, visible user action, not passive collection).
- IP-based geolocation fallback data (city-level) is similarly ephemeral — used to center the map for the session, not stored.
- `search_history` and any stored coordinates (bookmarks, saved_locations) are covered by the retention policy in [06-database-design.md](06-database-design.md) §6.5 and are deletable by the user (account settings → clear search history / delete bookmark), directly supporting a "right to deletion" posture even where no specific regulatory regime is assumed as a v1 requirement.

## 10.8 Third-party attribution as a security-adjacent concern

Several upstream sources' terms of use (FIRMS, OpenAQ, GeoNames, Nominatim, OSM, CelesTrak) are conditioned on correct attribution and fair-use behavior (§5, per-source "Attribution" and "Rate limit" fields). Violating these is a contractual/API-access risk rather than a classic security vulnerability, but it's tracked here because a revoked API key or IP ban from an upstream source is, in effect, a self-inflicted denial-of-service against a live product layer — the caching discipline in [03-architecture.md](03-architecture.md) and the attribution requirements in [05-api-integration-guide.md](05-api-integration-guide.md) are treated as availability-preserving controls, not just legal housekeeping.
