"use client";

import { useQuery } from "@tanstack/react-query";
import { Cartesian3, Color } from "cesium";
import { Entity, EllipseGraphics } from "resium";
import type { SpaceWeather } from "@/lib/adapters/swpc";

// Approximate geomagnetic poles, not the true real-time OVATION auroral
// oval model (that needs NOAA SWPC's separate ovation data feed — a bigger
// integration than "draw an oval"). Real, current Kp index from
// /api/space-weather (same query key SpaceWeatherPanel uses, deduped by
// TanStack Query — no extra network cost) drives visibility and radius: the
// real physical relationship is that a higher Kp pushes the auroral oval
// toward lower latitudes, so the oval grows and brightens with Kp and
// disappears below it entirely rather than always being drawn faintly.
const NORTH_GEOMAGNETIC_POLE = { latitude: 80.65, longitude: -72.68 };
const SOUTH_GEOMAGNETIC_POLE = { latitude: -80.65, longitude: 107.32 };
const VISIBILITY_THRESHOLD_KP = 2;
const AURORA_ALTITUDE_M = 100_000; // ~real-world aurora altitude, illustrative

export function AuroraLayer() {
  const { data } = useQuery<SpaceWeather>({
    queryKey: ["space-weather"],
    queryFn: async () => {
      const res = await fetch("/api/space-weather");
      if (!res.ok) throw new Error("Failed to fetch space weather");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!data || data.kpIndex < VISIBILITY_THRESHOLD_KP) return null;

  const radiusM = 1_200_000 + data.kpIndex * 350_000;
  const alpha = Math.min(0.5, 0.12 + data.kpIndex * 0.04);

  return (
    <>
      {[NORTH_GEOMAGNETIC_POLE, SOUTH_GEOMAGNETIC_POLE].map((pole, i) => (
        <Entity
          key={i}
          position={Cartesian3.fromDegrees(pole.longitude, pole.latitude, AURORA_ALTITUDE_M)}
        >
          <EllipseGraphics
            semiMajorAxis={radiusM}
            semiMinorAxis={radiusM}
            height={AURORA_ALTITUDE_M}
            material={Color.LIME.withAlpha(alpha)}
            outline
            outlineColor={Color.LIME.withAlpha(Math.min(0.8, alpha + 0.2))}
          />
        </Entity>
      ))}
    </>
  );
}
