"use client";

import { Cartesian3, Color } from "cesium";
import { Entity, PointGraphics } from "resium";
import { useWildfires } from "@/lib/use-wildfires";
import { useUiStore } from "@/lib/store";
import type { FireDetection } from "@/lib/adapters/firms";

// NASA FIRMS active-fire detections — docs/05-api-integration-guide.md §5.3.
// Explicitly satellite thermal-anomaly detections, not confirmed wildfires
// (can include agricultural burning/flares) — surfaced in the detail panel
// per the FIRMS disclaimer, not overclaimed as "confirmed fire".
export function WildfireLayer() {
  const { data } = useWildfires();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  if (!data) return null;

  return (
    <>
      {data.map((fire) => (
        <Entity
          key={`${fire.latitude}-${fire.longitude}-${fire.acquiredAt}`}
          position={Cartesian3.fromDegrees(fire.longitude, fire.latitude)}
          name="Fire detection"
          onClick={() => setSelectedEvent(toSelectedEvent(fire))}
        >
          <PointGraphics
            pixelSize={5}
            color={Color.ORANGERED.withAlpha(0.85)}
            outlineColor={Color.BLACK}
            outlineWidth={0.5}
          />
        </Entity>
      ))}
    </>
  );
}

function toSelectedEvent(fire: FireDetection) {
  return {
    kind: "wildfire" as const,
    title: "Thermal anomaly (satellite detection)",
    attributes: [
      { label: "Brightness", value: `${fire.brightness.toFixed(1)} K` },
      { label: "Confidence", value: fire.confidence },
      { label: "Satellite", value: fire.satellite },
      { label: "Detected", value: new Date(fire.acquiredAt).toLocaleString() },
    ],
    latitude: fire.latitude,
    longitude: fire.longitude,
  };
}
