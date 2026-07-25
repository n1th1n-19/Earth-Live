"use client";

import { Cartesian3, Color } from "cesium";
import { Entity, PointGraphics } from "resium";
import { useEarthquakes } from "@/lib/use-earthquakes";
import { useEarthquakeHistory } from "@/lib/use-earthquake-history";
import { useUiStore } from "@/lib/store";
import type { Earthquake } from "@/lib/adapters/usgs-earthquakes";

// Magnitude-scaled markers, colored by severity — docs/04-ui-ux-spec.md §4.5
// ("color is never the sole channel": size scales with magnitude too).
function colorFor(mag: number | null): Color {
  if (mag == null) return Color.GRAY;
  if (mag < 3) return Color.YELLOW.withAlpha(0.8);
  if (mag < 5) return Color.ORANGE.withAlpha(0.85);
  return Color.RED.withAlpha(0.9);
}

function sizeFor(mag: number | null): number {
  if (mag == null) return 6;
  return Math.max(6, Math.min(28, mag * 5));
}

export function EarthquakeLayer() {
  const replayMode = useUiStore((s) => s.replayMode);
  const replayWindowStart = useUiStore((s) => s.replayWindowStart);
  const replayCursor = useUiStore((s) => s.replayCursor);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  const live = useEarthquakes();
  const history = useEarthquakeHistory(replayWindowStart, replayCursor, replayMode);
  const data = replayMode ? history.data : live.data;

  if (!data) return null;

  return (
    <>
      {data.map((quake) => (
        <Entity
          key={quake.id}
          position={Cartesian3.fromDegrees(quake.longitude, quake.latitude)}
          name={quake.place ?? "Earthquake"}
          onClick={() => setSelectedEvent(toSelectedEvent(quake))}
        >
          <PointGraphics
            pixelSize={sizeFor(quake.magnitude)}
            color={colorFor(quake.magnitude)}
            outlineColor={Color.BLACK}
            outlineWidth={1}
          />
        </Entity>
      ))}
    </>
  );
}

function toSelectedEvent(quake: Earthquake) {
  return {
    kind: "earthquake" as const,
    title: quake.place ?? "Earthquake",
    attributes: [
      { label: "Magnitude", value: quake.magnitude?.toFixed(1) ?? "—" },
      { label: "Depth", value: `${quake.depthKm.toFixed(1)} km` },
      { label: "Time", value: new Date(quake.occurredAt).toLocaleString() },
      { label: "Tsunami warning", value: quake.tsunami ? "Yes" : "No" },
    ],
    sourceUrl: quake.url,
    latitude: quake.latitude,
    longitude: quake.longitude,
  };
}
