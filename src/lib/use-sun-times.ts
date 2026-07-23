"use client";

import { useQuery } from "@tanstack/react-query";
import type { SunTimes } from "@/lib/adapters/sunrise-sunset";

export function useSunTimes(latitude: number | null, longitude: number | null) {
  return useQuery<SunTimes>({
    queryKey: ["sun-times", latitude?.toFixed(1), longitude?.toFixed(1)],
    queryFn: async () => {
      const res = await fetch(`/api/sun?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error("Failed to fetch sun times");
      return res.json();
    },
    enabled: latitude != null && longitude != null,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
