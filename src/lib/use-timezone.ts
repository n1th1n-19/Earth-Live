"use client";

import { useQuery } from "@tanstack/react-query";
import type { TimezoneInfo } from "@/lib/adapters/geonames";

// GeoNames timezone-by-coordinate — docs/05-api-integration-guide.md §5.8.
// Used for the current map location generally; the browser's own
// Intl.DateTimeFormat (zero-cost, no network) remains the preferred path
// wherever only the user's own device timezone is needed.
export function useTimezone(latitude: number | null, longitude: number | null) {
  return useQuery<TimezoneInfo>({
    queryKey: ["timezone", latitude?.toFixed(2), longitude?.toFixed(2)],
    queryFn: async () => {
      const res = await fetch(`/api/timezone?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error("Failed to fetch timezone");
      return res.json();
    },
    enabled: latitude != null && longitude != null,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
