"use client";

import { useQuery } from "@tanstack/react-query";
import type { Disaster } from "@/lib/adapters/gdacs";

// GDACS re-scores active events roughly hourly, and the server caches for 30
// minutes, so polling faster would only re-serve the same cached payload.
export function useDisasters() {
  return useQuery<Disaster[]>({
    queryKey: ["disasters"],
    queryFn: async () => {
      const res = await fetch("/api/disasters");
      if (!res.ok) throw new Error("Failed to fetch disasters");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
}
