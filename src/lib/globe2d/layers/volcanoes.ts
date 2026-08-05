"use client";

import { useStaticGeoJson } from "@/lib/globe2d/use-static-geojson";
import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

const VOLCANOES_URL = "/data/volcanoes.geojson";
const LABEL_MIN_SCALE_FACTOR = 3;
const RECENT_ERUPTION_CUTOFF_YEAR = new Date().getFullYear() - 100;

export interface Volcano {
  name: string;
  volcanoType: string | null;
  country: string | null;
  lastEruptionYear: number | null;
  elevationM: number | null;
  longitude: number;
  latitude: number;
}

function mapFeature(f: GeoJSON.Feature): Volcano {
  const [longitude, latitude] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
  const p = f.properties as {
    name: string;
    type: string | null;
    country: string | null;
    lastEruptionYear: number | null;
    elevationM: number | null;
  };
  return {
    name: p.name,
    volcanoType: p.type,
    country: p.country,
    lastEruptionYear: p.lastEruptionYear,
    elevationM: p.elevationM,
    longitude,
    latitude,
  };
}

function isRecentlyActive(year: number | null): boolean {
  return year != null && year >= RECENT_ERUPTION_CUTOFF_YEAR;
}

function formatEruptionYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function useVolcanoesData(): Volcano[] | null {
  return useStaticGeoJson(VOLCANOES_URL, mapFeature);
}

export function draw(args: DrawArgs, data: Volcano[] | null) {
  if (!data) return;
  const { ctx, projection, scaleFactor } = args;
  const showLabels = scaleFactor > LABEL_MIN_SCALE_FACTOR;

  for (const volcano of data) {
    if (!args.isFrontFacing(volcano.longitude, volcano.latitude)) continue;
    const p = projection([volcano.longitude, volcano.latitude]);
    if (!p) continue;
    const active = isRecentlyActive(volcano.lastEruptionYear);
    const color = active ? "rgba(255,69,0,0.95)" : "rgba(255,69,0,0.45)";
    const iconRadius = (active ? 5 : 3.5) * scaleFactor;
    icons.volcano(ctx, p[0], p[1], iconRadius, color);
    if (showLabels) {
      ctx.save();
      ctx.font = "11px monospace";
      ctx.fillStyle = "#ffa500";
      ctx.textAlign = "center";
      ctx.fillText(volcano.name, p[0], p[1] - iconRadius - 4);
      ctx.restore();
    }
  }
}

export function getHitCandidates(args: DrawArgs, data: Volcano[] | null): HitCandidate[] {
  if (!data) return [];
  const out: HitCandidate[] = [];
  for (const volcano of data) {
    if (!args.isFrontFacing(volcano.longitude, volcano.latitude)) continue;
    const p = args.projection([volcano.longitude, volcano.latitude]);
    if (!p) continue;

    const attributes = [
      { label: "Type", value: volcano.volcanoType ?? "Unknown" },
      {
        label: "Last eruption",
        value: volcano.lastEruptionYear != null ? formatEruptionYear(volcano.lastEruptionYear) : "Undated",
      },
    ];
    if (volcano.country) attributes.push({ label: "Country", value: volcano.country });
    if (volcano.elevationM != null) {
      attributes.push({ label: "Elevation", value: `${volcano.elevationM.toLocaleString()} m` });
    }

    out.push({
      screenX: p[0],
      screenY: p[1],
      screenRadius: 8,
      label: volcano.name,
      detail: volcano.volcanoType ?? "Volcano",
      toSelectedEvent: () => ({
        kind: "volcano",
        title: volcano.name,
        attributes,
        latitude: volcano.latitude,
        longitude: volcano.longitude,
      }),
    });
  }
  return out;
}
