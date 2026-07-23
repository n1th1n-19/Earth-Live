"use client";

import * as Cesium from "cesium";
import { Entity, PointGraphics } from "resium";
import { useFlights } from "@/lib/use-flights";
import { useUiStore } from "@/lib/store";
import type { Flight } from "@/lib/adapters/opensky";

// Capped to MAX_FLIGHTS (src/lib/adapters/opensky.ts) and rendered as plain
// points for now — heading-aware icons and marker clustering for the full
// global set are TODO.md Phase 5 items.
export function FlightsLayer() {
  const { data } = useFlights();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  if (!data) return null;

  return (
    <>
      {data.map((flight) => (
        <Entity
          key={flight.icao24}
          position={Cesium.Cartesian3.fromDegrees(
            flight.longitude,
            flight.latitude,
            flight.altitudeM ?? 0,
          )}
          name={flight.callsign ?? flight.icao24}
          onClick={() => setSelectedEvent(toSelectedEvent(flight))}
        >
          <PointGraphics
            pixelSize={6}
            color={Cesium.Color.CYAN.withAlpha(0.9)}
            outlineColor={Cesium.Color.BLACK}
            outlineWidth={1}
          />
        </Entity>
      ))}
    </>
  );
}

function toSelectedEvent(flight: Flight) {
  return {
    kind: "flight" as const,
    title: flight.callsign ?? flight.icao24,
    attributes: [
      { label: "Origin country", value: flight.originCountry },
      {
        label: "Altitude",
        value: flight.altitudeM != null ? `${Math.round(flight.altitudeM)} m` : "—",
      },
      {
        label: "Speed",
        value: flight.velocityMs != null ? `${Math.round(flight.velocityMs * 3.6)} km/h` : "—",
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
