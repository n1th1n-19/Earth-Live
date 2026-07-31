"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlaceInfo } from "@/lib/adapters/place-info";

// Lazy, per-selection place lookup — only fires once a place marker is
// actually selected, never for all 199 capitals up front.
export function usePlaceInfo(
  name: string | null,
  latitude: number | null,
  longitude: number | null,
) {
  const enabled = !!name && latitude != null && longitude != null;

  return useQuery<PlaceInfo>({
    queryKey: ["place-info", name, latitude, longitude],
    // `signal` comes from React Query and aborts in-flight requests when the
    // selection changes — clicking through several places quickly otherwise
    // leaves earlier lookups running to completion for results nobody sees.
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        name: name!,
        lat: String(latitude),
        lon: String(longitude),
      });
      const res = await fetch(`/api/place-info?${params}`, { signal });
      if (!res.ok) throw new Error(`place-info request failed with status ${res.status}`);
      return res.json();
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
