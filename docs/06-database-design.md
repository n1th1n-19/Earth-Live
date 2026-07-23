# 6. Database Design

Postgres (Neon), accessed via Prisma. See [03-architecture.md](03-architecture.md) §3.5 for why: the database holds **user-owned state and durable cache/log history**, never the live Earth data itself (that lives in Redis with short TTLs per [05-api-integration-guide.md](05-api-integration-guide.md) §5.12, and is fetched fresh from source on miss). All primary keys are UUIDv7 (time-sortable) unless noted. All tables have `created_at`/`updated_at` timestamptz columns (omitted from the column lists below for brevity, present on every table).

## 6.1 Entity overview

```
users ──1:N── sessions
users ──1:N── bookmarks
users ──1:N── saved_locations ──1:N── notifications
users ──1:N── notification_preferences
users ──1:N── search_history
users ──1:1── preferences
saved_locations ──1:N── notifications (event matches)
cached_weather / cached_earthquakes / cached_flights / cached_wildfires — independent,
    keyed by source+spatial/temporal bucket, not owned by any user
api_logs — independent, one row per upstream call (or batched/sampled at scale)
```

## 6.2 Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| email | text, unique, nullable | Nullable to support future OAuth-only accounts with no email disclosed |
| email_verified_at | timestamptz, nullable | |
| password_hash | text, nullable | argon2; null for OAuth-only accounts |
| display_name | text, nullable | |
| avatar_url | text, nullable | |
| auth_provider | enum('credentials','google','apple') | |
| auth_provider_id | text, nullable | External provider's subject ID |
| last_login_at | timestamptz, nullable | |

Indexes: unique on `email`; unique composite on `(auth_provider, auth_provider_id)`.

### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| session_token | text, unique | Opaque token bound to the httpOnly cookie |
| expires_at | timestamptz | |
| user_agent | text, nullable | For the account's "active sessions" security view |
| ip_address | inet, nullable | |

Indexes: unique on `session_token`; index on `(user_id, expires_at)`.

### `bookmarks`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| label | text | User-provided or resolved place name |
| latitude | double precision | |
| longitude | double precision | |
| kind | enum('place','coordinate','airport','event') | |
| metadata | jsonb, nullable | e.g., resolved place's country code, airport IATA code |
| sort_order | integer | For user-reorderable bookmark lists |

Indexes: index on `user_id`; unique composite on `(user_id, latitude, longitude)` rounded to ~5 decimal places at the application layer to prevent near-duplicate bookmarks.

Relationship: one user has many bookmarks (1:N). Bookmarks are the anchor a `saved_locations` entry can optionally reference when a bookmark is promoted to an alertable location (§`saved_locations` below) — modeled as a nullable FK from `saved_locations` to `bookmarks`, not the reverse, since not every bookmark needs alerting.

### `saved_locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| bookmark_id | uuid, nullable (FK → bookmarks.id, set null on delete) | Optional link back to the originating bookmark |
| label | text | e.g., "Home", "Parents' house" |
| latitude | double precision | |
| longitude | double precision | |
| alert_radius_km | integer, default 200 | Radius used for proximity notification matching |

Indexes: index on `user_id`; a spatial index (PostGIS `geography` column + GiST index, see §6.4) for efficient radius matching against incoming events.

Purpose: `saved_locations` is deliberately distinct from `bookmarks` — a bookmark is "a place I want to fly back to," a saved location is "a place I want to be alerted about." Most users will only ever create a "Home" saved location; keeping the concept separate from bookmarks keeps the notification-matching query scoped to a small table rather than scanning every bookmark of every user.

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| saved_location_id | uuid, nullable (FK → saved_locations.id, set null on delete) | Which saved location triggered this, if applicable |
| category | enum('earthquake','wildfire','cyclone','aurora','system') | |
| title | text | |
| body | text | |
| source_event_id | text, nullable | Upstream event identifier (e.g., USGS event ID) for de-duplication |
| read_at | timestamptz, nullable | |
| delivered_push_at | timestamptz, nullable | Null if push delivery wasn't enabled/attempted |

Indexes: index on `(user_id, read_at)` for the unread-count query; unique composite on `(user_id, category, source_event_id)` to prevent duplicate notifications for the same upstream event.

### `notification_preferences`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| category | enum('earthquake','wildfire','cyclone','aurora','system') | |
| min_severity | text, nullable | e.g., minimum magnitude for earthquakes, stored as text to stay generic across categories |
| enabled | boolean, default true | |
| push_enabled | boolean, default false | |

Indexes: unique composite on `(user_id, category)`.

### `preferences`
1:1 with `users` — a single row of app-wide settings (distinct from per-category `notification_preferences`).

| Column | Type | Notes |
|---|---|---|
| user_id | uuid (PK, FK → users.id, cascade delete) | |
| theme | enum('dark','light','system'), default 'dark' | |
| units | enum('metric','imperial'), default 'metric' | |
| language | text, default 'en' | BCP-47 tag |
| default_layers | jsonb | Array of layer IDs enabled by default |
| data_saver_mode | boolean, default false | |
| last_camera_position | jsonb, nullable | `{lat, lon, height, heading, pitch}` — resumes returning-visitor camera per FR-10 |

### `search_history`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → users.id, cascade delete) | |
| query | text | |
| resolved_kind | enum('place','coordinate','airport','flight','layer_action'), nullable | |
| resolved_latitude | double precision, nullable | |
| resolved_longitude | double precision, nullable | |

Indexes: index on `(user_id, created_at desc)` for the "recent searches" command-palette list; a periodic job prunes rows older than 90 days per user (privacy-minimizing retention, referenced in [10-security-guide.md](10-security-guide.md)).

### `cached_weather`, `cached_earthquakes`, `cached_flights`, `cached_wildfires`
These four tables are **not** the hot path (Redis is — see [05-api-integration-guide.md](05-api-integration-guide.md) §5.12) — they exist as a **durable, queryable history** that outlives Redis TTLs, powering Replay mode (FR-29) and the statistics dashboard's sparklines (FR-31) for ranges longer than a source's own historical-query API conveniently supports, or for sources whose historical query is rate-limited enough that pre-materializing is preferable to re-querying it live.

**`cached_earthquakes`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| source_event_id | text, unique | USGS event ID |
| magnitude | real | |
| depth_km | real | |
| latitude | double precision | |
| longitude | double precision | |
| occurred_at | timestamptz | |
| place_description | text | USGS's human-readable place string |
| raw_payload | jsonb | Full normalized source response, for detail-panel rendering without re-fetching |

Indexes: unique on `source_event_id`; spatial GiST index on the geography point (§6.4); index on `occurred_at` for replay range queries.

**`cached_wildfires`** — analogous shape: `source_detection_id` (composite of satellite+scan+track+acq_date/time per FIRMS row, since FIRMS doesn't issue a single stable ID), `latitude`, `longitude`, `brightness`, `confidence`, `satellite`, `detected_at`, `raw_payload`.

**`cached_flights`** — a **sampled**, not exhaustive, history (storing every 10-second tick of every global flight is not a v1 requirement and would be a significant storage cost for a feature — replay of individual flight paths — that is lower priority than quake/fire/cyclone replay). Stores periodic snapshots (e.g., one row per flight per 5 minutes) keyed by `(icao24, snapshot_at)`, sufficient for a coarse "flight density over time" replay visualization rather than frame-accurate path replay.

**`cached_weather`** — periodic snapshots per grid cell/region (not per-user-query), keyed by `(latitude_bucket, longitude_bucket, snapshot_at)`, populated by the same background pre-warming job described in [03-architecture.md](03-architecture.md) §3.4, used for weather-comparison (FR: "Weather comparison" feature) and historical trend sparklines.

### `api_logs`
| Column | Type | Notes |
|---|---|---|
| id | bigserial (PK) | High-volume table; a sequential bigint PK is more appropriate here than UUID |
| source | text | Adapter name, e.g. `"usgs_earthquakes"`, `"opensky"` |
| endpoint | text | |
| status_code | integer, nullable | Null if the request errored before a response (timeout/network) |
| latency_ms | integer | |
| cache_hit | boolean | |
| error_message | text, nullable | |
| requested_at | timestamptz | |

Indexes: index on `(source, requested_at desc)` — this table is the data source for the API Status panel (FR-42) and for Sentry/monitoring correlation. At scale, this table is partitioned by month and/or sampled (e.g., log 100% of errors but only 10% of successes) rather than growing unbounded — noted as an operational concern in [08-deployment-guide.md](08-deployment-guide.md), not a v1 blocker.

## 6.3 Relationships summary

- **users 1:N sessions** — cascade delete (deleting a user invalidates all sessions).
- **users 1:N bookmarks** — cascade delete.
- **users 1:N saved_locations** — cascade delete; `saved_locations` optionally references `bookmarks` (nullable FK, set-null on bookmark delete — losing the originating bookmark shouldn't silently delete an active alert configuration).
- **users 1:N notifications** — cascade delete; `notifications` optionally references `saved_locations` (set-null on delete, for the same reason as above).
- **users 1:N notification_preferences** — cascade delete; unique per `(user, category)`.
- **users 1:1 preferences** — cascade delete.
- **users 1:N search_history** — cascade delete; time-bounded retention.
- **cached_\* tables** — no FK to `users`; they are global, source-of-truth-derived caches independent of any individual user, queried by spatial/temporal range for Replay and the stats dashboard.
- **api_logs** — no FK to `users`; operational/observability data.

## 6.4 Spatial querying

Postgres's **PostGIS** extension is enabled for any table needing "nearby" queries (`saved_locations` for notification radius matching, `cached_earthquakes`/`cached_wildfires` for replay-range spatial queries). Coordinates are stored both as plain `double precision` lat/lon columns (simple, human-readable, sufficient for exact-point display) **and** as a generated `geography(Point, 4326)` column with a GiST index, used specifically for `ST_DWithin` radius queries — this dual representation avoids forcing every simple "show me this bookmark's coordinates" read through PostGIS function overhead while still getting indexed spatial performance where it's actually needed (notification matching, nearby-event queries).

## 6.5 Data retention & privacy notes

- `search_history` is pruned after 90 days per user (configurable), consistent with data-minimization principles covered in [10-security-guide.md](10-security-guide.md).
- `api_logs` success rows are sampled/pruned aggressively (30-day retention for full rows, aggregated metrics retained longer); error rows retained 90 days for debugging.
- `cached_flights` snapshots are pruned after the replay window's maximum supported range (default 30 days) to bound storage growth, since flight data volume is the highest-cardinality of the four cache tables.
- No table stores third-party personal data beyond what the user explicitly provided (email, display name, OAuth profile fields) — no upstream API in [05-api-integration-guide.md](05-api-integration-guide.md) returns personal data about *other* individuals that Earth Live persists.
