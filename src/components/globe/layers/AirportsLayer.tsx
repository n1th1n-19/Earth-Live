"use client";

import { useEffect, useMemo, useState } from "react";
import { Cartesian2, Cartesian3, Color } from "cesium";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { getGlowDataUri } from "@/lib/glow-billboard";
import { useUiStore } from "@/lib/store";

// OurAirports' public dataset, filtered offline to large/medium airports
// (5273 of the full ~80k, which includes every grass strip and heliport) —
// free, keyless, no attribution restriction (public domain / CC0 per
// ourairports.com/data/). Bundled once at build time, same pattern as the
// capitals/volcanoes/borders GeoJSON.
const AIRPORTS_URL = "/data/airports.geojson";

// "Nearby" re-queried against the real camera target on every moveEnd
// (src/components/globe/Globe.tsx already samples this for the share-URL
// feature) — not a server round trip, since the whole slim bundle is already
// in memory; a plain distance sort over ~5000 points is cheap.
const NEARBY_COUNT = 20;

// Below this altitude "nearby" is a meaningful question; above it, every
// airport on the visible hemisphere would technically qualify, which isn't
// what a "nearby airports" feature means.
const MAX_HEIGHT_M = 3_000_000;

interface Airport {
  name: string;
  iata: string | null;
  icao: string | null;
  size: "large" | "medium";
  country: string | null;
  elevationFt: number | null;
  longitude: number;
  latitude: number;
}

interface AirportFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name: string;
    iata: string | null;
    icao: string | null;
    size: "large" | "medium";
    country: string | null;
    elevationFt: number | null;
  };
}

// Great-circle distance, km — haversine. Good enough for a nearest-N sort;
// this isn't a navigation instrument.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function AirportsLayer() {
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const cameraPosition = useUiStore((s) => s.cameraPosition);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  useEffect(() => {
    let cancelled = false;
    fetch(AIRPORTS_URL)
      .then((res) => res.json())
      .then((geojson: { features: AirportFeature[] }) => {
        if (cancelled) return;
        setAirports(
          geojson.features.map((f) => ({
            name: f.properties.name,
            iata: f.properties.iata,
            icao: f.properties.icao,
            size: f.properties.size,
            country: f.properties.country,
            elevationFt: f.properties.elevationFt,
            longitude: f.geometry.coordinates[0],
            latitude: f.geometry.coordinates[1],
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nearby = useMemo(() => {
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

  if (nearby.length === 0) return null;

  return (
    <>
      {nearby.map((airport) => {
        const code = airport.iata ?? airport.icao ?? "—";
        return (
          <Entity
            key={`${airport.icao ?? airport.iata ?? airport.name}-${airport.latitude}-${airport.longitude}`}
            position={Cartesian3.fromDegrees(airport.longitude, airport.latitude)}
            name={`${code} · ${airport.name}`}
            description={airport.country ?? undefined}
            onClick={() =>
              setSelectedEvent({
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
              })
            }
          >
            <BillboardGraphics
              image={getGlowDataUri()}
              color={Color.SKYBLUE.withAlpha(airport.size === "large" ? 0.9 : 0.6)}
              width={airport.size === "large" ? 16 : 11}
              height={airport.size === "large" ? 16 : 11}
            />
            <LabelGraphics
              text={code}
              font="11px monospace"
              fillColor={Color.SKYBLUE}
              pixelOffset={new Cartesian2(0, -13)}
              showBackground
              backgroundColor={Color.BLACK.withAlpha(0.5)}
            />
          </Entity>
        );
      })}
    </>
  );
}
