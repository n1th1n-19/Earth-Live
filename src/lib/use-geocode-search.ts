"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeocodeResult } from "@/lib/adapters/nominatim";

// FR-13: debounced autocomplete against the geocoding proxy.
export function useGeocodeSearch(rawQuery: string) {
  const [debounced, setDebounced] = useState(rawQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(rawQuery), 250);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  return useQuery<GeocodeResult[]>({
    queryKey: ["geocode", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(debounced)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 60 * 1000,
  });
}
