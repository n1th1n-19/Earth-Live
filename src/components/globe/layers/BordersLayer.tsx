"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcType, Cartesian3, Color, Math as CesiumMath } from "cesium";
import { Entity, PolylineGraphics } from "resium";

// Natural Earth 1:110m country borders, bundled static at build time.
const BORDERS_URL = "/data/ne_110m_admin_0_countries.geojson";

// Replaces <GeoJsonDataSource>, which was the source of two real problems:
//
// 1. Crashes. Cesium builds a *fill* polygon for every GeoJSON Polygon even
//    when the fill is fully transparent, and does so with rhumb-line arcs.
//    Subdividing Natural Earth's country rings that way blew up in
//    `computeRhumbLineSubdivision` with "RangeError: Too many properties to
//    enumerate" — an out-of-memory failure that killed the whole render loop
//    ("An error occurred while rendering. Rendering has stopped.") and took
//    entity picking down with it, so clicking any marker stopped working.
//    Drawing the rings as polylines means no polygon geometry is ever built.
//
// 2. Invisible borders. `strokeWidth` on a GeoJSON polygon maps to Cesium's
//    polygon *outline*, which is a native WebGL line — most drivers clamp
//    those to 1px and antialias them to nothing at whole-globe zoom.
//    PolylineGraphics uses Cesium's own screen-space-width polyline shader,
//    so the width below is honoured at every camera distance.
//
// ArcType.GEODESIC keeps segments following the curve of the globe (straight
// 3D chords would tunnel through it on long spans like the 49th parallel),
// and the explicit coarse granularity bounds how many points any one segment
// can subdivide into — which is the specific thing that ran away before.
const GRANULARITY = CesiumMath.RADIANS_PER_DEGREE;
const BORDER_COLOR = Color.CYAN.withAlpha(0.85);
const BORDER_WIDTH = 2;

type Ring = number[][];

interface BordersGeoJson {
  features: {
    geometry:
      | { type: "Polygon"; coordinates: Ring[] }
      | { type: "MultiPolygon"; coordinates: Ring[][] };
  }[];
}

function toRings(geojson: BordersGeoJson): Ring[] {
  const rings: Ring[] = [];
  for (const feature of geojson.features) {
    const { geometry } = feature;
    if (geometry.type === "Polygon") {
      rings.push(...geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) rings.push(...polygon);
    }
  }
  return rings;
}

export function BordersLayer() {
  const [rings, setRings] = useState<Ring[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BORDERS_URL)
      .then((res) => res.json())
      .then((geojson: BordersGeoJson) => {
        if (!cancelled) setRings(toRings(geojson));
      })
      .catch(() => {
        // A missing/!ok borders file leaves the globe without outlines
        // rather than tearing down the whole scene — every other layer
        // still renders real data.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Built once from the static file; Cesium rebuilds a polyline whenever its
  // positions array identity changes, so these must not be recreated per render.
  const positions = useMemo(
    () => rings?.map((ring) => Cartesian3.fromDegreesArray(ring.flat())) ?? [],
    [rings],
  );

  return (
    <>
      {positions.map((ringPositions, i) => (
        <Entity key={i}>
          <PolylineGraphics
            positions={ringPositions}
            width={BORDER_WIDTH}
            material={BORDER_COLOR}
            arcType={ArcType.GEODESIC}
            granularity={GRANULARITY}
          />
        </Entity>
      ))}
    </>
  );
}
