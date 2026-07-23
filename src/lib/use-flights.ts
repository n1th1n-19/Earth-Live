"use client";

import { useQuery } from "@tanstack/react-query";
import type { Flight } from "@/lib/adapters/opensky";

export function useFlights() {
  return useQuery<Flight[]>({
    queryKey: ["flights"],
    queryFn: async () => {
      const res = await fetch("/api/flights");
      if (!res.ok) throw new Error("Failed to fetch flights");
      return res.json();
    },
    staleTime: 45 * 1000,
    refetchInterval: 45 * 1000,
  });
}
