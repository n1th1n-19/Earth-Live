"use client";

import { useEffect, useState } from "react";
import { geoBounds, geoGraticule } from "d3";
import type { DrawArgs } from "@/lib/globe2d/types";

const LAND_URL = "/data/ne_110m_land.geojson";
const DOT_SPACING = 16;

export interface LandDot {
  lng: number;
  lat: number;
}

export interface LandData {
  features: GeoJSON.FeatureCollection;
  dots: LandDot[];
}

function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInFeature(point: [number, number], feature: GeoJSON.Feature): boolean {
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    const coordinates = geometry.coordinates;
    if (!pointInPolygon(point, coordinates[0])) return false;
    for (let i = 1; i < coordinates.length; i++) {
      if (pointInPolygon(point, coordinates[i])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (pointInPolygon(point, polygon[0])) {
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInPolygon(point, polygon[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

function generateDotsInPolygon(feature: GeoJSON.Feature, dotSpacing: number): LandDot[] {
  const dots: LandDot[] = [];
  const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature);
  const stepSize = dotSpacing * 0.08;
  for (let lng = minLng; lng <= maxLng; lng += stepSize) {
    for (let lat = minLat; lat <= maxLat; lat += stepSize) {
      if (pointInFeature([lng, lat], feature)) dots.push({ lng, lat });
    }
  }
  return dots;
}

export function useLandData(): LandData | null {
  const [data, setData] = useState<LandData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LAND_URL)
      .then((res) => res.json())
      .then((features: GeoJSON.FeatureCollection) => {
        if (cancelled) return;
        const dots = features.features.flatMap((feature) => generateDotsInPolygon(feature, DOT_SPACING));
        setData({ features, dots });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

export function draw(args: DrawArgs, data: LandData) {
  const { ctx, path, scaleFactor } = args;

  const graticule = geoGraticule();
  ctx.beginPath();
  path(graticule());
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1 * scaleFactor;
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  data.features.features.forEach((feature) => path(feature));
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1 * scaleFactor;
  ctx.stroke();

  data.dots.forEach((dot) => {
    if (!args.isFrontFacing(dot.lng, dot.lat)) return;
    const projected = args.projection([dot.lng, dot.lat]);
    if (!projected) return;
    ctx.beginPath();
    ctx.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
    ctx.fillStyle = "#999999";
    ctx.fill();
  });
}
