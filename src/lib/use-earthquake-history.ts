"use client";

import { useQuery } from "@tanstack/react-query";
import type { Earthquake } from "@/lib/adapters/usgs-earthquakes";

// FR-29 Replay mode — queries the durable history built up by
// src/lib/adapters/usgs-earthquakes.ts's persistence side-effect, not the
// live feed.
export function useEarthquakeHistory(from: string, to: string, enabled: boolean) {
  return useQuery<Earthquake[]>({
    queryKey: ["earthquakes-history", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/earthquakes/history?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch earthquake history");
      return res.json();
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
