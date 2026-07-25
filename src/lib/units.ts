import type { Units } from "@/lib/store";

// Real conversions used by every display component — a units toggle that
// doesn't actually change any number would be exactly the kind of fake
// control this project avoids everywhere else.
export function formatTemperature(celsius: number, units: Units): string {
  if (units === "imperial") return `${Math.round(celsius * (9 / 5) + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatSpeedKmh(kmh: number, units: Units): string {
  if (units === "imperial") return `${Math.round(kmh / 1.60934)} mph`;
  return `${Math.round(kmh)} km/h`;
}

export function formatDistanceKm(km: number, units: Units): string {
  if (units === "imperial") return `${(km / 1.60934).toFixed(1)} mi`;
  return `${km.toFixed(1)} km`;
}
