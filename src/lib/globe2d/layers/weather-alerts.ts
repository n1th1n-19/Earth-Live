"use client";

import { useWeatherAlerts } from "@/lib/use-weather-alerts";
import { nwsIcon } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";
import type { WeatherAlert } from "@/lib/adapters/nws-alerts";

const SEVERITY_COLOR: Record<WeatherAlert["severity"], string> = {
  Extreme: "#ff2d55",
  Severe: "#ffb340",
};

export function useWeatherAlertsData() {
  return useWeatherAlerts().data;
}

function ringToLngLat(ring: number[]): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < ring.length; i += 2) points.push([ring[i], ring[i + 1]]);
  return points;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toSelectedEvent(alert: WeatherAlert) {
  const attributes = [
    { label: "Event", value: alert.event },
    { label: "Severity", value: alert.severity },
  ];
  if (alert.areaDesc) attributes.push({ label: "Area", value: alert.areaDesc });
  if (alert.senderName) attributes.push({ label: "Issued by", value: alert.senderName });
  if (alert.expires) attributes.push({ label: "Expires", value: new Date(alert.expires).toLocaleString() });
  return {
    kind: "alert" as const,
    title: alert.headline ?? alert.event,
    attributes,
    latitude: alert.latitude,
    longitude: alert.longitude,
  };
}

export function draw(args: DrawArgs, data: WeatherAlert[] | undefined) {
  if (!data) return;
  const { ctx, path, projection, scaleFactor } = args;

  for (const alert of data) {
    const color = SEVERITY_COLOR[alert.severity];
    for (const ring of alert.rings) {
      const coords = ringToLngLat(ring);
      if (coords.length < 3) continue;
      const polygon: GeoJSON.Polygon = { type: "Polygon", coordinates: [[...coords, coords[0]]] };
      ctx.beginPath();
      path(polygon);
      ctx.fillStyle = hexToRgba(color, 0.22);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scaleFactor;
      ctx.stroke();
    }
    if (args.isFrontFacing(alert.longitude, alert.latitude)) {
      const p = projection([alert.longitude, alert.latitude]);
      if (p) nwsIcon(alert.event)(ctx, p[0], p[1], 5 * scaleFactor, color);
    }
  }
}

function pointInPolygonScreen(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygon containment doesn't fit the nearest-within-radius model every other layer uses, so this is checked separately by Globe2D rather than via getHitCandidates. */
export function hitTestPoint(
  args: DrawArgs,
  data: WeatherAlert[] | undefined,
  screenX: number,
  screenY: number,
): HitCandidate | null {
  if (!data) return null;
  for (const alert of data) {
    // projection() (unlike path()) doesn't clip back-hemisphere points, so a
    // ring on the far side of the globe would still project to *some* screen
    // coordinate — one that could coincide with the click even though draw()
    // never rendered it there.
    if (!args.isFrontFacing(alert.longitude, alert.latitude)) continue;
    for (const ring of alert.rings) {
      const screenRing = ringToLngLat(ring)
        .map(([lng, lat]) => args.projection([lng, lat]))
        .filter((p): p is [number, number] => p != null);
      if (screenRing.length < 3) continue;
      if (pointInPolygonScreen([screenX, screenY], screenRing)) {
        return {
          screenX,
          screenY,
          screenRadius: 0,
          label: `${alert.event} · ${alert.severity}`,
          detail: alert.areaDesc ?? alert.headline ?? alert.event,
          toSelectedEvent: () => toSelectedEvent(alert),
        };
      }
    }
  }
  return null;
}
