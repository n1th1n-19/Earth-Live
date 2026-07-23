"use client";

import { useEffect, useState } from "react";

// See docs/02-product-requirements.md FR-6..FR-9 and docs/04-ui-ux-spec.md §2.4.1.
export type LocationSource = "gps" | "ip" | "default";

export interface UserLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
  /** True once we've heard back from the browser Geolocation API (granted or not). */
  resolved: boolean;
}

// Default global view per PRD §2.4.1 — wide zoom centered near the equator,
// used only until GPS or the IP-hint fallback resolves.
const DEFAULT_LOCATION: UserLocation = {
  latitude: 20,
  longitude: 0,
  source: "default",
  resolved: false,
};

/**
 * Real GPS first (browser Geolocation API), falling back to the coarse
 * IP-hint the app's own /api/geo route derives from Vercel's edge geolocation
 * headers (docs/03-architecture.md §3.8), then the default global view.
 * Never uses a third-party IP-geolocation API — see docs/05-api-integration-guide.md,
 * which does not name one; the Vercel-header hint is the documented free path.
 */
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);

  useEffect(() => {
    let cancelled = false;

    async function fallbackToIpHint() {
      try {
        const res = await fetch("/api/geo");
        if (!res.ok) return;
        const data = (await res.json()) as { latitude?: number; longitude?: number };
        if (!cancelled && data.latitude != null && data.longitude != null) {
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            source: "ip",
            resolved: true,
          });
        } else if (!cancelled) {
          setLocation((prev) => ({ ...prev, resolved: true }));
        }
      } catch {
        if (!cancelled) setLocation((prev) => ({ ...prev, resolved: true }));
      }
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      void fallbackToIpHint();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "gps",
          resolved: true,
        });
      },
      () => {
        void fallbackToIpHint();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return location;
}
