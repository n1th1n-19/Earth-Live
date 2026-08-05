"use client";

import { useWildfires } from "@/lib/use-wildfires";
import { icons } from "@/lib/globe2d/icons";
import { clusterPoints } from "@/lib/globe2d/clustering";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";
import type { FireDetection } from "@/lib/adapters/firms";

// Denser cell than earthquakes, matching Cesium's tighter useEntityClustering(8).
const CLUSTER_CELL_PX = 30;
const CLUSTER_MIN_SIZE = 8;

export function useWildfiresData() {
  return useWildfires().data;
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

function clusters(args: DrawArgs, data: FireDetection[]) {
  const visible = data.filter((f) => args.isFrontFacing(f.longitude, f.latitude));
  return clusterPoints(
    visible.map((f) => ({ lng: f.longitude, lat: f.latitude, item: f })),
    (lng, lat) => args.projection([lng, lat]),
    CLUSTER_CELL_PX,
  );
}

export function draw(args: DrawArgs, data: FireDetection[] | undefined) {
  if (!data) return;
  const { ctx, scaleFactor } = args;

  for (const cluster of clusters(args, data)) {
    if (cluster.items.length >= CLUSTER_MIN_SIZE) {
      icons.flame(ctx, cluster.screenX, cluster.screenY, 9 * scaleFactor, "rgba(255,69,0,0.9)");
      ctx.font = "10px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(String(cluster.items.length), cluster.screenX, cluster.screenY + 3);
    } else {
      for (const fire of cluster.items) {
        const p = args.projection([fire.longitude, fire.latitude]);
        if (!p) continue;
        icons.flame(ctx, p[0], p[1], 4 * scaleFactor, "rgba(255,69,0,0.85)");
      }
    }
  }
}

export function getHitCandidates(args: DrawArgs, data: FireDetection[] | undefined): HitCandidate[] {
  if (!data) return [];
  const out: HitCandidate[] = [];
  for (const cluster of clusters(args, data)) {
    if (cluster.items.length >= CLUSTER_MIN_SIZE) {
      out.push({
        screenX: cluster.screenX,
        screenY: cluster.screenY,
        screenRadius: 12,
        label: `${cluster.items.length} fire detections`,
        flyTo: { latitude: cluster.lat, longitude: cluster.lng },
      });
    } else {
      for (const fire of cluster.items) {
        const p = args.projection([fire.longitude, fire.latitude]);
        if (!p) continue;
        out.push({
          screenX: p[0],
          screenY: p[1],
          screenRadius: 7,
          label: "Fire detection",
          toSelectedEvent: () => toSelectedEvent(fire),
        });
      }
    }
  }
  return out;
}
