"use client";

import { useMemo } from "react";
import { useStaticGeoJson } from "@/lib/globe2d/use-static-geojson";
import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

const AIRPORTS_URL = "/data/airports.geojson";
const NEARBY_COUNT = 20;
const MAX_HEIGHT_M = 3_000_000;

export interface Airport {
  name: string;
  iata: string | null;
  icao: string | null;
  size: "large" | "medium";
  country: string | null;
  elevationFt: number | null;
  longitude: number;
  latitude: number;
}

function mapFeature(f: GeoJSON.Feature): Airport {
  const [longitude, latitude] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
  const p = f.properties as {
    name: string;
    iata: string | null;
    icao: string | null;
    size: "large" | "medium";
    country: string | null;
    elevationFt: number | null;
  };
  return {
    name: p.name,
    iata: p.iata,
    icao: p.icao,
    size: p.size,
    country: p.country,
    elevationFt: p.elevationFt,
    longitude,
    latitude,
  };
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useAirportsData(): Airport[] | null {
  return useStaticGeoJson(AIRPORTS_URL, mapFeature);
}

export function useNearbyAirports(
  airports: Airport[] | null,
  cameraPosition: { latitude: number; longitude: number; height: number } | null,
): Airport[] {
  return useMemo(() => {
    if (!airports || !cameraPosition || cameraPosition.height > MAX_HEIGHT_M) return [];
    return airports
      .map((airport) => ({
        airport,
        km: distanceKm(cameraPosition.latitude, cameraPosition.longitude, airport.latitude, airport.longitude),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, NEARBY_COUNT)
      .map((x) => x.airport);
  }, [airports, cameraPosition]);
}

export function draw(args: DrawArgs, nearby: Airport[]) {
  const { ctx, projection, scaleFactor } = args;
  for (const airport of nearby) {
    if (!args.isFrontFacing(airport.longitude, airport.latitude)) continue;
    const p = projection([airport.longitude, airport.latitude]);
    if (!p) continue;
    const code = airport.iata ?? airport.icao ?? "—";
    const size = (airport.size === "large" ? 5 : 3.5) * scaleFactor;
    icons.airportTower(ctx, p[0], p[1], size, `rgba(135,206,235,${airport.size === "large" ? 0.9 : 0.6})`);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#87ceeb";
    ctx.textAlign = "center";
    ctx.fillText(code, p[0], p[1] - size - 4);
  }
}

export function getHitCandidates(args: DrawArgs, nearby: Airport[]): HitCandidate[] {
  const out: HitCandidate[] = [];
  for (const airport of nearby) {
    if (!args.isFrontFacing(airport.longitude, airport.latitude)) continue;
    const p = args.projection([airport.longitude, airport.latitude]);
    if (!p) continue;
    const code = airport.iata ?? airport.icao ?? "—";
    out.push({
      screenX: p[0],
      screenY: p[1],
      screenRadius: 8,
      label: `${code} · ${airport.name}`,
      detail: airport.country ?? undefined,
      toSelectedEvent: () => ({
        kind: "airport",
        title: airport.name,
        attributes: [
          { label: "IATA", value: airport.iata ?? "—" },
          { label: "ICAO", value: airport.icao ?? "—" },
          { label: "Size", value: airport.size === "large" ? "Large airport" : "Medium airport" },
          ...(airport.country ? [{ label: "Country", value: airport.country }] : []),
          ...(airport.elevationFt != null
            ? [{ label: "Elevation", value: `${airport.elevationFt.toLocaleString()} ft` }]
            : []),
        ],
        latitude: airport.latitude,
        longitude: airport.longitude,
      }),
    });
  }
  return out;
}
