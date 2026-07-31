"use client";

import { Cartesian2, Cartesian3, Color } from "cesium";
import { useEffect, useState } from "react";
import { Entity, LabelGraphics, ModelGraphics } from "resium";
import { useSatelliteGroup } from "@/lib/use-satellites";
import { propagateTle } from "@/lib/satellite-propagation";

// Real low-poly glTF, not a flat icon — public/models/satellite.glb (Kenney
// Space Kit's satelliteDish model, CC0 — credited in CreditsPanel.tsx).
const SATELLITE_MODEL_URI = "/models/satellite.glb";

// ISS position, propagated client-side from CelesTrak TLEs via SGP4 —
// docs/05-api-integration-guide.md §5.4. Updated every 2s (real orbital
// speed is ~7.7 km/s, so a coarser interval would visibly lag).
export function IssLayer() {
  const { data: stations } = useSatelliteGroup("stations");
  const [position, setPosition] = useState<Cartesian3 | null>(null);

  const iss = stations?.find((s) => s.name.includes("ISS"));

  useEffect(() => {
    if (!iss) return;

    function update() {
      if (!iss) return;
      const propagated = propagateTle(iss.tleLine1, iss.tleLine2, new Date());
      if (!propagated) return;
      setPosition(
        Cartesian3.fromDegrees(
          propagated.longitude,
          propagated.latitude,
          propagated.heightKm * 1000,
        ),
      );
    }

    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [iss]);

  if (!position) return null;

  return (
    <Entity position={position} name="International Space Station">
      {/* minimumPixelSize keeps the ISS a legible icon at whole-globe zoom;
          maximumScale stops it filling the screen when flown up close. */}
      <ModelGraphics uri={SATELLITE_MODEL_URI} minimumPixelSize={44} maximumScale={40_000} scale={1} />
      <LabelGraphics
        text="ISS"
        font="12px monospace"
        fillColor={Color.WHITE}
        pixelOffset={new Cartesian2(0, -16)}
        showBackground
        backgroundColor={Color.BLACK.withAlpha(0.6)}
      />
    </Entity>
  );
}
