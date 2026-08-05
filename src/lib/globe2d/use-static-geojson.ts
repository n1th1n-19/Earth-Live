"use client";

import { useEffect, useState } from "react";

/** Fetches a bundled static GeoJSON file once and maps each feature — the shared shape of Places/Volcanoes/Airports (Cesium versions each hand-rolled this same effect). */
export function useStaticGeoJson<T>(url: string, map: (feature: GeoJSON.Feature) => T): T[] | null {
  const [data, setData] = useState<T[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => res.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (!cancelled) setData(geojson.features.map(map));
      })
      .catch(() => {
        // Missing/broken static file: layer just stays empty, matches the
        // Cesium versions' behavior (no throw, no scene teardown).
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `map` is a fresh closure per render by design; only `url` identity should re-trigger the fetch.
  }, [url]);

  return data;
}
