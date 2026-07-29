"use client";

import { Cartesian3, Color } from "cesium";
import { BillboardGraphics, CustomDataSource, Entity } from "resium";
import { useWildfires } from "@/lib/use-wildfires";
import { useEntityClustering } from "@/lib/use-entity-clustering";
import { getIconDataUri } from "@/lib/icon-billboard";
import { useUiStore } from "@/lib/store";
import type { FireDetection } from "@/lib/adapters/firms";

// NASA FIRMS active-fire detections — docs/05-api-integration-guide.md §5.3.
// Explicitly satellite thermal-anomaly detections, not confirmed wildfires
// (can include agricultural burning/flares) — surfaced in the detail panel
// per the FIRMS disclaimer, not overclaimed as "confirmed fire". Capped at
// MAX_FIRES (src/lib/adapters/firms.ts) but still dense enough that
// clustering (useEntityClustering) matters more here than any other layer.
export function WildfireLayer() {
  const { data } = useWildfires();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const clustering = useEntityClustering(8);

  if (!data) return null;

  return (
    <CustomDataSource clustering={clustering}>
      {data.map((fire) => (
        <Entity
          key={`${fire.latitude}-${fire.longitude}-${fire.acquiredAt}`}
          position={Cartesian3.fromDegrees(fire.longitude, fire.latitude)}
          name="Fire detection"
          onClick={() => setSelectedEvent(toSelectedEvent(fire))}
        >
          <BillboardGraphics
            image={getIconDataUri("flame")}
            color={Color.ORANGERED.withAlpha(0.85)}
            width={16}
            height={16}
          />
        </Entity>
      ))}
    </CustomDataSource>
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
