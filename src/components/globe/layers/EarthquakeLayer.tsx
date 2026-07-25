"use client";

import { useMemo } from "react";
import { Cartesian3, Color, Rectangle, SingleTileImageryProvider } from "cesium";
import { CustomDataSource, Entity, ImageryLayer as ResiumImageryLayer, PointGraphics } from "resium";
import { useEarthquakes } from "@/lib/use-earthquakes";
import { useEarthquakeHistory } from "@/lib/use-earthquake-history";
import { useEntityClustering } from "@/lib/use-entity-clustering";
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

const HEATMAP_RECTANGLE = Rectangle.fromDegrees(-180, -90, 180, 90);

// Additive radial-gradient blobs, not a real kernel-density estimate — an
// honest approximation, same spirit as the FIRMS "not confirmed fire"
// disclaimer: overlapping quakes read brighter/more saturated, which is
// enough to tell dense fault regions from sparse ones at a glance.
function buildHeatmapDataUrl(quakes: Earthquake[]): string | null {
  if (typeof document === "undefined" || quakes.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.globalCompositeOperation = "lighter";
  for (const quake of quakes) {
    const x = ((quake.longitude + 180) / 360) * canvas.width;
    const y = ((90 - quake.latitude) / 180) * canvas.height;
    const radius = Math.max(10, Math.min(48, (quake.magnitude ?? 2) * 9));
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,60,0,0.5)");
    gradient.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL("image/png");
}

export function EarthquakeLayer() {
  const replayMode = useUiStore((s) => s.replayMode);
  const replayWindowStart = useUiStore((s) => s.replayWindowStart);
  const replayCursor = useUiStore((s) => s.replayCursor);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const heatmap = useUiStore((s) => s.earthquakeHeatmap);

  const live = useEarthquakes();
  const history = useEarthquakeHistory(replayWindowStart, replayCursor, replayMode);
  const data = replayMode ? history.data : live.data;
  const clustering = useEntityClustering();

  const heatmapUrl = useMemo(
    () => (heatmap && data ? buildHeatmapDataUrl(data) : null),
    [heatmap, data],
  );
  const heatmapProvider = useMemo(
    () => (heatmapUrl ? new SingleTileImageryProvider({ url: heatmapUrl, rectangle: HEATMAP_RECTANGLE }) : null),
    [heatmapUrl],
  );

  if (!data) return null;

  if (heatmap) {
    return heatmapProvider ? <ResiumImageryLayer imageryProvider={heatmapProvider} alpha={0.85} /> : null;
  }

  return (
    <CustomDataSource clustering={clustering}>
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
    </CustomDataSource>
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
