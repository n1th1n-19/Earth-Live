"use client";

import * as Cesium from "cesium";
import { useEffect, useState } from "react";
import { Entity, LabelGraphics, PointGraphics } from "resium";
import { useSatelliteGroup } from "@/lib/use-satellites";
import { propagateTle } from "@/lib/satellite-propagation";

// ISS position, propagated client-side from CelesTrak TLEs via SGP4 —
// docs/05-api-integration-guide.md §5.4. Updated every 2s (real orbital
// speed is ~7.7 km/s, so a coarser interval would visibly lag).
export function IssLayer() {
  const { data: stations } = useSatelliteGroup("stations");
  const [position, setPosition] = useState<Cesium.Cartesian3 | null>(null);

  const iss = stations?.find((s) => s.name.includes("ISS"));

  useEffect(() => {
    if (!iss) return;

    function update() {
      if (!iss) return;
      const propagated = propagateTle(iss.tleLine1, iss.tleLine2, new Date());
      if (!propagated) return;
      setPosition(
        Cesium.Cartesian3.fromDegrees(
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
      <PointGraphics pixelSize={10} color={Cesium.Color.WHITE} outlineColor={Cesium.Color.CYAN} outlineWidth={2} />
      <LabelGraphics
        text="ISS"
        font="12px monospace"
        fillColor={Cesium.Color.WHITE}
        pixelOffset={new Cesium.Cartesian2(0, -16)}
        showBackground
        backgroundColor={Cesium.Color.BLACK.withAlpha(0.6)}
      />
    </Entity>
  );
}
