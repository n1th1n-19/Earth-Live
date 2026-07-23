"use client";

import { useQuery } from "@tanstack/react-query";
import type { CurrentWeather } from "@/lib/adapters/open-meteo";

// staleTime/refetchInterval tuned to the source's real cadence, not faster —
// docs/05-api-integration-guide.md §5.12 ("Weather (Open-Meteo): 15-20 min").
export function useWeather(latitude: number | null, longitude: number | null) {
  return useQuery<CurrentWeather>({
    queryKey: ["weather", latitude?.toFixed(2), longitude?.toFixed(2)],
    queryFn: async () => {
      const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error("Failed to fetch weather");
      return res.json();
    },
    enabled: latitude != null && longitude != null,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
