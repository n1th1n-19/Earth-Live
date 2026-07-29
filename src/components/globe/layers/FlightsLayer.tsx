"use client";

import { Fragment, useState } from "react";
import { Cartesian3, Color, Math as CesiumMath } from "cesium";
import { BillboardGraphics, CustomDataSource, Entity, PolylineGraphics } from "resium";
import { useFlights } from "@/lib/use-flights";
import { useEntityClustering } from "@/lib/use-entity-clustering";
import { getIconDataUri } from "@/lib/icon-billboard";
import { useUiStore } from "@/lib/store";
import { formatSpeedKmh } from "@/lib/units";
import type { Flight } from "@/lib/adapters/opensky";

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
            <Entity
              position={Cartesian3.fromDegrees(
                flight.longitude,
                flight.latitude,
                flight.altitudeM ?? 0,
              )}
              name={flight.callsign ?? flight.icao24}
              onClick={() => setSelectedEvent(toSelectedEvent(flight))}
            >
              <BillboardGraphics
                image={getIconDataUri("plane")}
                color={Color.CYAN.withAlpha(0.9)}
                width={18}
                height={18}
                // alignedAxis measures rotation from geographic north rather
                // than screen-up, so the icon keeps pointing the plane's
                // real heading as the camera tilts/rotates — verified
                // against a real flight in the browser check, not guessed.
                alignedAxis={Cartesian3.UNIT_Z}
                rotation={CesiumMath.toRadians(-(flight.headingDeg ?? 0))}
              />
            </Entity>
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
