"use client";

import { Fragment, useState } from "react";
import { Cartesian3, Color, HeadingPitchRoll, Math as CesiumMath, Transforms } from "cesium";
import { CustomDataSource, Entity, ModelGraphics, PolylineGraphics } from "resium";
import { useFlights } from "@/lib/use-flights";
import { useEntityClustering } from "@/lib/use-entity-clustering";
import { useUiStore } from "@/lib/store";
import { formatSpeedKmh } from "@/lib/units";
import type { Flight } from "@/lib/adapters/opensky";

// Real low-poly glTF, not a flat icon — public/models/airplane.glb (Poly
// Pizza, "Poly by Google", CC-BY 3.0 — credited in CreditsPanel.tsx).
const AIRPLANE_MODEL_URI = "/models/airplane.glb";

// Capped to MAX_FLIGHTS (src/lib/adapters/opensky.ts). Clustering (via
// useEntityClustering) keeps dense airspace legible.
const TRAIL_LENGTH = 6;

type LatLon = { latitude: number; longitude: number };

export function FlightsLayer() {
  const { data } = useFlights();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const clustering = useEntityClustering();

  // Real per-aircraft position history accumulated client-side across polls
  // — OpenSky's free anonymous tier doesn't expose historical tracks, so a
  // trail is built up here rather than fetched, not synthesized motion.
  // Capped at TRAIL_LENGTH and rebuilt from the latest poll each time, so an
  // aircraft that drops out of coverage drops out of `trails` too — bounded,
  // can't grow unboundedly like the FIRMS/USGS layers almost did.
  //
  // This can't be a plain useEffect + setState (React flags that as a
  // cascading-render risk, same issue page.tsx hit with its shared-URL
  // state), but it also isn't pure per-render derivation — it depends on the
  // *previous* poll's trails. React's sanctioned pattern for exactly this
  // ("adjusting state when a prop changes") is comparing against the last
  // seen value and calling setState directly in the render body, guarded so
  // it only fires once per new `data` reference from React Query.
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

  if (!data) return null;

  return (
    <CustomDataSource clustering={clustering}>
      {data.map((flight) => {
        const trail = trails.get(flight.icao24);
        return (
          <Fragment key={flight.icao24}>
            {trail?.slice(1).map((point, i) => (
              <Entity key={i}>
                <PolylineGraphics
                  positions={Cartesian3.fromDegreesArray([
                    trail[i].longitude,
                    trail[i].latitude,
                    point.longitude,
                    point.latitude,
                  ])}
                  width={2}
                  material={Color.CYAN.withAlpha(0.1 + 0.5 * ((i + 1) / trail.length))}
                />
              </Entity>
            ))}
            {(() => {
              const position = Cartesian3.fromDegrees(
                flight.longitude,
                flight.latitude,
                flight.altitudeM ?? 0,
              );
              // Real 3D model orientation, not a flat billboard rotation —
              // Transforms.headingPitchRollQuaternion computes a real-world
              // heading/pitch/roll rotation at this exact position.
              // HeadingPitchRoll.heading is radians clockwise from north,
              // the same convention OpenSky's headingDeg already uses.
              const orientation = Transforms.headingPitchRollQuaternion(
                position,
                new HeadingPitchRoll(CesiumMath.toRadians(flight.headingDeg ?? 0), 0, 0),
              );
              return (
                <Entity
                  position={position}
                  orientation={orientation}
                  name={flight.callsign ?? flight.icao24}
                  onClick={() => setSelectedEvent(toSelectedEvent(flight))}
                >
                  <ModelGraphics uri={AIRPLANE_MODEL_URI} minimumPixelSize={24} scale={1} />
                </Entity>
              );
            })()}
          </Fragment>
        );
      })}
    </CustomDataSource>
  );
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
