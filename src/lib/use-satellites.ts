"use client";

import { useQuery } from "@tanstack/react-query";
import type { SatelliteElement } from "@/lib/adapters/celestrak";

// TLEs refresh 1-2x/day upstream — matches the 6hr server cache TTL
// (docs/05-api-integration-guide.md §5.4). Live motion comes from
// client-side SGP4 propagation of these elements, not from refetching.
export function useSatelliteGroup(group: "stations" | "active" | "weather" | "starlink") {
  return useQuery<SatelliteElement[]>({
    queryKey: ["satellites", group],
    queryFn: async () => {
      const res = await fetch(`/api/satellites?group=${group}`);
      if (!res.ok) throw new Error("Failed to fetch satellite elements");
      return res.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
  });
}
