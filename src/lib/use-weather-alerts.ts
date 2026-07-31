"use client";

import { useQuery } from "@tanstack/react-query";
import type { WeatherAlert } from "@/lib/adapters/nws-alerts";

// NWS republishes alerts continuously; the server caches for 5 minutes, so
// polling faster would only re-serve the same cached payload.
export function useWeatherAlerts() {
  return useQuery<WeatherAlert[]>({
    queryKey: ["weather-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/weather-alerts");
      if (!res.ok) throw new Error("Failed to fetch weather alerts");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
