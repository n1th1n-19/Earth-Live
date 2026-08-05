"use client";

import { geoCircle } from "d3";
import type { DrawArgs } from "@/lib/globe2d/types";

// Simplified subsolar-point approximation (declination via the standard
// day-of-year cosine formula, longitude from UTC hour ignoring the ~15min
// equation-of-time wobble) — plenty accurate for a decorative night-shading
// overlay, not a navigation instrument. Real astronomical ephemeris (Cesium's
// `enableLighting`) is unnecessary precision here.
function subsolarPoint(date: Date): { lat: number; lng: number } {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  const lat = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lng = (((-15 * (utcHours - 12) + 180) % 360) + 360) % 360;

  return { lat, lng: lng - 180 };
}

export function draw(args: DrawArgs, now: Date) {
  const { ctx, path } = args;
  const sun = subsolarPoint(now);
  const antisolar: [number, number] = [((sun.lng + 180 + 180) % 360) - 180, -sun.lat];

  // Radius kept just under 90° — exactly 90 sits on the orthographic
  // projection's own clip boundary, which made d3 emit an empty/unstable
  // path in testing (both boundaries coincide). 89.9° is visually identical.
  const nightHemisphere = geoCircle().radius(89.9).center(antisolar)();
  ctx.beginPath();
  path(nightHemisphere);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fill();
}
