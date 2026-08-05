"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { FlightRoute } from "@/lib/adapters/adsbdb";

// Shared with useVisibleFlightRoutes (src/lib/globe2d/layers/flights.ts),
// which fans this out across several callsigns via useQueries — same
// queryKey shape so both hooks hit the same cache entry for a given
// callsign instead of double-fetching.
export function flightRouteQueryOptions(callsign: string): UseQueryOptions<FlightRoute | null> {
  return {
    queryKey: ["flight-route", callsign],
    queryFn: async () => {
      const res = await fetch(`/api/flight-route?callsign=${encodeURIComponent(callsign)}`);
      // Throw rather than swallowing to null: a transport/5xx failure is a
      // real error React Query should retry and surface via isError, and is
      // a different outcome from "adsbdb has no route for this callsign",
      // which comes back as a 200 with a null body.
      if (!res.ok) throw new Error(`flight-route request failed with status ${res.status}`);
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  };
}

// Lazy, per-selection lookup (adsbdb.com) — see FlightsLayer.tsx. Only
// enabled when a callsign is passed, so it never fires for unselected
// flights. Real airlines only; general-aviation callsigns come back `null`
// and no route line is drawn — no synthesized fallback.
export function useFlightRoute(callsign: string | null) {
  return useQuery<FlightRoute | null>({
    ...flightRouteQueryOptions(callsign ?? ""),
    enabled: !!callsign,
  });
}
