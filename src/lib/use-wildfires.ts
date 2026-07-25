"use client";

import { useQuery } from "@tanstack/react-query";
import type { FireDetection } from "@/lib/adapters/firms";

// Matches the 3hr satellite-revisit cadence documented in
// docs/05-api-integration-guide.md §5.12. First fetch in any 3hr window is
// slow (~90s, global VIIRS scope) but is shared via Redis cache-aside across
// every user, so most requests hit cache.
export function useWildfires() {
  return useQuery<FireDetection[]>({
    queryKey: ["wildfires"],
    queryFn: async () => {
      const res = await fetch("/api/wildfires");
      if (!res.ok) throw new Error("Failed to fetch wildfires");
      return res.json();
    },
    staleTime: 3 * 60 * 60 * 1000,
    refetchInterval: 3 * 60 * 60 * 1000,
  });
}
