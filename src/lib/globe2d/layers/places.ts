"use client";

import { useStaticGeoJson } from "@/lib/globe2d/use-static-geojson";
import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

const CAPITALS_URL = "/data/capitals.geojson";
const LABEL_MIN_SCALE_FACTOR = 3;

export interface Capital {
  name: string;
  country: string;
  population: number | null;
  longitude: number;
  latitude: number;
}

function mapFeature(f: GeoJSON.Feature): Capital {
  const [longitude, latitude] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
  const p = f.properties as { name: string; country: string; population?: number | null };
  return { name: p.name, country: p.country, population: p.population ?? null, longitude, latitude };
}

export function usePlacesData(): Capital[] | null {
  return useStaticGeoJson(CAPITALS_URL, mapFeature);
}

export function draw(args: DrawArgs, data: Capital[] | null) {
  if (!data) return;
  const { ctx, projection, scaleFactor } = args;
  const showLabels = scaleFactor > LABEL_MIN_SCALE_FACTOR;

  for (const capital of data) {
    if (!args.isFrontFacing(capital.longitude, capital.latitude)) continue;
    const p = projection([capital.longitude, capital.latitude]);
    if (!p) continue;
    icons.star(ctx, p[0], p[1], 3 * scaleFactor, "rgba(255,255,255,0.85)");
    if (showLabels) {
      ctx.font = "11px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(capital.name, p[0], p[1] - 10);
    }
  }
}

export function getHitCandidates(args: DrawArgs, data: Capital[] | null): HitCandidate[] {
  if (!data) return [];
  const out: HitCandidate[] = [];
  for (const capital of data) {
    if (!args.isFrontFacing(capital.longitude, capital.latitude)) continue;
    const p = args.projection([capital.longitude, capital.latitude]);
    if (!p) continue;
    out.push({
      screenX: p[0],
      screenY: p[1],
      screenRadius: 8,
      label: capital.name,
      detail: capital.country,
      toSelectedEvent: () => ({
        kind: "place",
        title: capital.name,
        placeName: capital.name,
        country: capital.country,
        attributes: [
          { label: "Country", value: capital.country },
          ...(capital.population != null
            ? [{ label: "Population", value: capital.population.toLocaleString() }]
            : []),
        ],
        latitude: capital.latitude,
        longitude: capital.longitude,
      }),
    });
  }
  return out;
}
