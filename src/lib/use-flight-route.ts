"use client";

import { useQuery } from "@tanstack/react-query";
import type { FlightRoute } from "@/lib/adapters/adsbdb";

// Lazy, per-selection lookup (adsbdb.com) — see FlightsLayer.tsx. Only
// enabled when a callsign is passed, so it never fires for unselected
// flights. Real airlines only; general-aviation callsigns come back `null`
// and no route line is drawn — no synthesized fallback.
export function useFlightRoute(callsign: string | null) {
  return useQuery<FlightRoute | null>({
    queryKey: ["flight-route", callsign],
    queryFn: async () => {
      const res = await fetch(`/api/flight-route?callsign=${encodeURIComponent(callsign!)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!callsign,
    staleTime: 60 * 60 * 1000,
  });
}
