"use client";

import { useState } from "react";
import { geoInterpolate } from "d3";
import { useFlights } from "@/lib/use-flights";
import { useFlightRoute } from "@/lib/use-flight-route";
import { useUiStore } from "@/lib/store";
import { formatSpeedKmh } from "@/lib/units";
import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";
import type { Flight } from "@/lib/adapters/opensky";

const TRAIL_LENGTH = 6;

type LatLon = { latitude: number; longitude: number };

export interface FlightsState {
  flights: Flight[] | undefined;
  trails: Map<string, LatLon[]>;
}

// Mirrors FlightsLayer.tsx's cascading-state pattern: trails depend on the
// *previous* poll, so React's sanctioned "adjust state when a prop changes"
// approach (compare against last-seen value, setState in the render body) is
// used rather than a plain effect.
export function useFlightsData(): FlightsState {
  const { data } = useFlights();
  const [prevData, setPrevData] = useState(data);
  const [trails, setTrails] = useState<Map<string, LatLon[]>>(new Map());

  if (data && data !== prevData) {
    setPrevData(data);
    const next = new Map<string, LatLon[]>();
    for (const flight of data) {
      const existing = trails.get(flight.icao24) ?? [];
      next.set(
        flight.icao24,
        [...existing, { latitude: flight.latitude, longitude: flight.longitude }].slice(-TRAIL_LENGTH),
      );
    }
    setTrails(next);
  }

  return { flights: data, trails };
}

export function useSelectedFlightRoute() {
  const selectedEvent = useUiStore((s) => s.selectedEvent);
  const callsign = selectedEvent?.kind === "flight" ? (selectedEvent.callsign ?? null) : null;
  return useFlightRoute(callsign).data;
}

function toSelectedEvent(flight: Flight) {
  const units = useUiStore.getState().units;
  const altitudeLabel =
    flight.altitudeM == null
      ? "—"
      : units === "imperial"
        ? `${Math.round(flight.altitudeM * 3.28084)} ft`
        : `${Math.round(flight.altitudeM)} m`;

  return {
    kind: "flight" as const,
    title: flight.callsign ?? flight.icao24,
    callsign: flight.callsign ?? undefined,
    attributes: [
      { label: "Origin country", value: flight.originCountry },
      { label: "Altitude", value: altitudeLabel },
      {
        label: "Speed",
        value: flight.velocityMs != null ? formatSpeedKmh(flight.velocityMs * 3.6, units) : "—",
      },
      {
        label: "Heading",
        value: flight.headingDeg != null ? `${Math.round(flight.headingDeg)}°` : "—",
      },
    ],
    latitude: flight.latitude,
    longitude: flight.longitude,
  };
}

// Orthographic projection distorts direction near the limb of the visible
// disc, so heading can't just be "rotate by headingDeg" — project the real
// position and a point a short distance ahead along the true heading, then
// take the screen-space angle between them.
function screenHeadingRad(args: DrawArgs, lng: number, lat: number, headingDeg: number): number {
  const p0 = args.projection([lng, lat]);
  if (!p0) return 0;
  const rad = (headingDeg * Math.PI) / 180;
  const step = 0.3;
  const dLat = Math.cos(rad) * step;
  const dLng = (Math.sin(rad) * step) / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const p1 = args.projection([lng + dLng, lat + dLat]);
  if (!p1) return 0;
  return Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1]));
}

export function draw(args: DrawArgs, state: FlightsState, route: { origin: LatLon; destination: LatLon } | undefined) {
  const { ctx, path, projection, scaleFactor } = args;

  if (route) {
    const interpolate = geoInterpolate(
      [route.origin.longitude, route.origin.latitude],
      [route.destination.longitude, route.destination.latitude],
    );
    const line: [number, number][] = Array.from({ length: 65 }, (_, i) => interpolate(i / 64));
    ctx.beginPath();
    path({ type: "LineString", coordinates: line });
    ctx.strokeStyle = "rgba(0,255,255,0.8)";
    ctx.lineWidth = 2 * scaleFactor;
    ctx.stroke();
  }

  if (!state.flights) return;

  for (const flight of state.flights) {
    const trail = state.trails.get(flight.icao24);
    if (trail) {
      for (let i = 1; i < trail.length; i++) {
        if (!args.isFrontFacing(trail[i].longitude, trail[i].latitude)) continue;
        ctx.beginPath();
        path({
          type: "LineString",
          coordinates: [
            [trail[i - 1].longitude, trail[i - 1].latitude],
            [trail[i].longitude, trail[i].latitude],
          ],
        });
        ctx.strokeStyle = `rgba(0,255,255,${0.1 + 0.5 * (i / trail.length)})`;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.stroke();
      }
    }

    if (!args.isFrontFacing(flight.longitude, flight.latitude)) continue;
    const p = projection([flight.longitude, flight.latitude]);
    if (!p) continue;
    const rotation = screenHeadingRad(args, flight.longitude, flight.latitude, flight.headingDeg ?? 0);
    icons.plane(ctx, p[0], p[1], 6 * scaleFactor, "#e5e5e5", rotation);
  }
}

export function getHitCandidates(args: DrawArgs, state: FlightsState): HitCandidate[] {
  if (!state.flights) return [];
  const out: HitCandidate[] = [];
  for (const flight of state.flights) {
    if (!args.isFrontFacing(flight.longitude, flight.latitude)) continue;
    const p = args.projection([flight.longitude, flight.latitude]);
    if (!p) continue;
    out.push({
      screenX: p[0],
      screenY: p[1],
      screenRadius: 8,
      label: flight.callsign ?? flight.icao24,
      toSelectedEvent: () => toSelectedEvent(flight),
    });
  }
  return out;
}
