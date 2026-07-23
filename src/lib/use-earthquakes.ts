"use client";

import { useQuery } from "@tanstack/react-query";
import type { Earthquake } from "@/lib/adapters/usgs-earthquakes";

// Matches the 60s cadence documented in docs/05-api-integration-guide.md §5.12.
export function useEarthquakes() {
  return useQuery<Earthquake[]>({
    queryKey: ["earthquakes"],
    queryFn: async () => {
      const res = await fetch("/api/earthquakes");
      if (!res.ok) throw new Error("Failed to fetch earthquakes");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
