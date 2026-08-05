"use client";

import { useQuery } from "@tanstack/react-query";
import { geoCircle } from "d3";
import type { DrawArgs } from "@/lib/globe2d/types";
import type { SpaceWeather } from "@/lib/adapters/swpc";

// Approximate geomagnetic poles, not the true OVATION auroral-oval model —
// same approximation the Cesium AuroraLayer made. Real Kp index drives
// visibility and radius.
const NORTH_GEOMAGNETIC_POLE: [number, number] = [-72.68, 80.65];
const SOUTH_GEOMAGNETIC_POLE: [number, number] = [107.32, -80.65];
const VISIBILITY_THRESHOLD_KP = 2;
const EARTH_RADIUS_M = 6_371_000;

export function useAuroraData() {
  return useQuery<SpaceWeather>({
    queryKey: ["space-weather"],
    queryFn: async () => {
      const res = await fetch("/api/space-weather");
      if (!res.ok) throw new Error("Failed to fetch space weather");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function draw(args: DrawArgs, data: SpaceWeather | undefined) {
  if (!data || data.kpIndex < VISIBILITY_THRESHOLD_KP) return;

  const { ctx, path } = args;
  const radiusM = 1_200_000 + data.kpIndex * 350_000;
  const radiusDeg = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const alpha = Math.min(0.5, 0.12 + data.kpIndex * 0.04);
  const circle = geoCircle().radius(radiusDeg);

  for (const pole of [NORTH_GEOMAGNETIC_POLE, SOUTH_GEOMAGNETIC_POLE]) {
    ctx.beginPath();
    path(circle.center(pole)());
    ctx.fillStyle = `rgba(50, 255, 50, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(50, 255, 50, ${Math.min(0.8, alpha + 0.2)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
