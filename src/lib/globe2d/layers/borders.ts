"use client";

import { useEffect, useState } from "react";
import type { DrawArgs } from "@/lib/globe2d/types";

const BORDERS_URL = "/data/ne_110m_admin_0_countries.geojson";

type Ring = number[][];

function toRings(geojson: GeoJSON.FeatureCollection): Ring[] {
  const rings: Ring[] = [];
  for (const feature of geojson.features) {
    const { geometry } = feature;
    if (geometry.type === "Polygon") {
      rings.push(...(geometry.coordinates as Ring[]));
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates as Ring[][]) rings.push(...polygon);
    }
  }
  return rings;
}

export function useBordersData(): Ring[] | null {
  const [rings, setRings] = useState<Ring[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BORDERS_URL)
      .then((res) => res.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (!cancelled) setRings(toRings(geojson));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return rings;
}

export function draw(args: DrawArgs, rings: Ring[]) {
  const { ctx, path, scaleFactor } = args;
  ctx.strokeStyle = "rgba(103, 232, 249, 0.85)";
  ctx.lineWidth = 1 * scaleFactor;
  for (const ring of rings) {
    ctx.beginPath();
    path({ type: "LineString", coordinates: ring });
    ctx.stroke();
  }
}
