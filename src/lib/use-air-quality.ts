"use client";

import { useQuery } from "@tanstack/react-query";
import type { AirQuality } from "@/lib/adapters/openaq";

// Matches the 30-min cache documented in docs/05-api-integration-guide.md §5.2.
export function useAirQuality(latitude: number | null, longitude: number | null) {
  return useQuery<AirQuality | null>({
    queryKey: ["air-quality", latitude?.toFixed(2), longitude?.toFixed(2)],
    queryFn: async () => {
      const res = await fetch(`/api/air-quality?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error("Failed to fetch air quality");
      return res.json();
    },
    enabled: latitude != null && longitude != null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
}
