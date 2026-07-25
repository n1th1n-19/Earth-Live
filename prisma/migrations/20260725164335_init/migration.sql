-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('credentials', 'google', 'apple');

-- CreateEnum
CREATE TYPE "BookmarkKind" AS ENUM ('place', 'coordinate', 'airport', 'event');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('earthquake', 'wildfire', 'cyclone', 'aurora', 'system');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('dark', 'light', 'system');

-- CreateEnum
CREATE TYPE "Units" AS ENUM ('metric', 'imperial');

-- CreateEnum
CREATE TYPE "SearchResolvedKind" AS ENUM ('place', 'coordinate', 'airport', 'flight', 'layer_action');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "password_hash" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "auth_provider" "AuthProvider" NOT NULL,
    "auth_provider_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "kind" "BookmarkKind" NOT NULL,
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bookmark_id" TEXT,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "alert_radius_km" INTEGER NOT NULL DEFAULT 200,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "geog" geography(Point, 4326),

    CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "saved_location_id" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source_event_id" TEXT,
    "read_at" TIMESTAMP(3),
    "delivered_push_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "min_severity" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "user_id" TEXT NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'dark',
    "units" "Units" NOT NULL DEFAULT 'metric',
    "language" TEXT NOT NULL DEFAULT 'en',
    "default_layers" JSONB NOT NULL DEFAULT '[]',
    "data_saver_mode" BOOLEAN NOT NULL DEFAULT false,
    "last_camera_position" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resolved_kind" "SearchResolvedKind",
    "resolved_latitude" DOUBLE PRECISION,
    "resolved_longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_earthquakes" (
    "id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "depth_km" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "place_description" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geog" geography(Point, 4326),

    CONSTRAINT "cached_earthquakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_wildfires" (
    "id" TEXT NOT NULL,
    "source_detection_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "brightness" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "satellite" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geog" geography(Point, 4326),

    CONSTRAINT "cached_wildfires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_flights" (
    "id" TEXT NOT NULL,
    "icao24" TEXT NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude_m" DOUBLE PRECISION,
    "velocity_ms" DOUBLE PRECISION,
    "heading_deg" DOUBLE PRECISION,
    "callsign" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_weather" (
    "id" TEXT NOT NULL,
    "latitude_bucket" DOUBLE PRECISION NOT NULL,
    "longitude_bucket" DOUBLE PRECISION NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_weather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status_code" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "cache_hit" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_auth_provider_id_key" ON "users"("auth_provider", "auth_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_latitude_longitude_key" ON "bookmarks"("user_id", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "saved_locations_user_id_idx" ON "saved_locations"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_category_source_event_id_key" ON "notifications"("user_id", "category", "source_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_category_key" ON "notification_preferences"("user_id", "category");

-- CreateIndex
CREATE INDEX "search_history_user_id_created_at_idx" ON "search_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cached_earthquakes_source_event_id_key" ON "cached_earthquakes"("source_event_id");

-- CreateIndex
CREATE INDEX "cached_earthquakes_occurred_at_idx" ON "cached_earthquakes"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "cached_wildfires_source_detection_id_key" ON "cached_wildfires"("source_detection_id");

-- CreateIndex
CREATE INDEX "cached_wildfires_detected_at_idx" ON "cached_wildfires"("detected_at");

-- CreateIndex
CREATE INDEX "cached_flights_snapshot_at_idx" ON "cached_flights"("snapshot_at");

-- CreateIndex
CREATE UNIQUE INDEX "cached_flights_icao24_snapshot_at_key" ON "cached_flights"("icao24", "snapshot_at");

-- CreateIndex
CREATE INDEX "cached_weather_snapshot_at_idx" ON "cached_weather"("snapshot_at");

-- CreateIndex
CREATE UNIQUE INDEX "cached_weather_latitude_bucket_longitude_bucket_snapshot_at_key" ON "cached_weather"("latitude_bucket", "longitude_bucket", "snapshot_at");

-- CreateIndex
CREATE INDEX "api_logs_source_requested_at_idx" ON "api_logs"("source", "requested_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_bookmark_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "bookmarks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_saved_location_id_fkey" FOREIGN KEY ("saved_location_id") REFERENCES "saved_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
