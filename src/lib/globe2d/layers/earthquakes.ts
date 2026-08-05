"use client";

import { useEarthquakes } from "@/lib/use-earthquakes";
import { useEarthquakeHistory } from "@/lib/use-earthquake-history";
import { icons } from "@/lib/globe2d/icons";
import { clusterPoints } from "@/lib/globe2d/clustering";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";
import type { Earthquake } from "@/lib/adapters/usgs-earthquakes";

const CLUSTER_CELL_PX = 40;
const CLUSTER_MIN_SIZE = 4; // matches Cesium's default minimumClusterSize

function quakeColor(mag: number | null): string {
  if (mag == null) return "#9ca3af";
  if (mag < 3) return "#facc15";
  if (mag < 5) return "#fb923c";
  return "#ef4444";
}

function quakeRadius(mag: number | null): number {
  if (mag == null) return 2;
  return Math.max(2, Math.min(9, mag * 1.6));
}

export function useEarthquakeData(
  replayMode: boolean,
  replayWindowStart: string,
  replayCursor: string,
): Earthquake[] | undefined {
  const live = useEarthquakes();
  const history = useEarthquakeHistory(replayWindowStart, replayCursor, replayMode);
  return replayMode ? history.data : live.data;
}

function toSelectedEvent(q: Earthquake) {
  return {
    kind: "earthquake" as const,
    title: q.place ?? "Earthquake",
    attributes: [
      { label: "Magnitude", value: q.magnitude?.toFixed(1) ?? "—" },
      { label: "Depth", value: `${q.depthKm.toFixed(1)} km` },
      { label: "Time", value: new Date(q.occurredAt).toLocaleString() },
      { label: "Tsunami warning", value: q.tsunami ? "Yes" : "No" },
    ],
    sourceUrl: q.url,
    latitude: q.latitude,
    longitude: q.longitude,
  };
}

function clusters(args: DrawArgs, data: Earthquake[]) {
  const visible = data.filter((q) => args.isFrontFacing(q.longitude, q.latitude));
  return clusterPoints(
    visible.map((q) => ({ lng: q.longitude, lat: q.latitude, item: q })),
    (lng, lat) => args.projection([lng, lat]),
    CLUSTER_CELL_PX,
  );
}

export function draw(args: DrawArgs, data: Earthquake[] | null | undefined, heatmap: boolean) {
  if (!data) return;
  const { ctx, scaleFactor } = args;

  if (heatmap) {
    for (const q of data) {
      if (!args.isFrontFacing(q.longitude, q.latitude)) continue;
      const p = args.projection([q.longitude, q.latitude]);
      if (!p) continue;
      const radius = Math.max(10, Math.min(48, (q.magnitude ?? 2) * 9)) * scaleFactor;
      const gradient = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], radius);
      gradient.addColorStop(0, "rgba(255,60,0,0.5)");
      gradient.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  for (const cluster of clusters(args, data)) {
    if (cluster.items.length >= CLUSTER_MIN_SIZE) {
      const maxMag = Math.max(...cluster.items.map((q) => q.magnitude ?? 0));
      icons.quakeBurst(ctx, cluster.screenX, cluster.screenY, 10 * scaleFactor, quakeColor(maxMag));
      ctx.font = "10px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(String(cluster.items.length), cluster.screenX, cluster.screenY + 3);
    } else {
      for (const q of cluster.items) {
        const p = args.projection([q.longitude, q.latitude]);
        if (!p) continue;
        icons.quakeBurst(ctx, p[0], p[1], quakeRadius(q.magnitude) * scaleFactor, quakeColor(q.magnitude));
      }
    }
  }
}

export function getHitCandidates(
  args: DrawArgs,
  data: Earthquake[] | null | undefined,
  heatmap: boolean,
): HitCandidate[] {
  if (!data || heatmap) return [];
  const out: HitCandidate[] = [];
  for (const cluster of clusters(args, data)) {
    if (cluster.items.length >= CLUSTER_MIN_SIZE) {
      out.push({
        screenX: cluster.screenX,
        screenY: cluster.screenY,
        screenRadius: 14,
        label: `${cluster.items.length} earthquakes`,
        flyTo: { latitude: cluster.lat, longitude: cluster.lng },
      });
    } else {
      for (const q of cluster.items) {
        const p = args.projection([q.longitude, q.latitude]);
        if (!p) continue;
        out.push({
          screenX: p[0],
          screenY: p[1],
          screenRadius: 8,
          label: q.place ?? "Earthquake",
          detail: q.magnitude != null ? `M${q.magnitude.toFixed(1)}` : undefined,
          toSelectedEvent: () => toSelectedEvent(q),
        });
      }
    }
  }
  return out;
}
