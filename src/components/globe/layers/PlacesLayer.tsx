"use client";

import { useEffect, useState } from "react";
import { Cartesian2, Cartesian3, Color, DistanceDisplayCondition } from "cesium";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { getGlowDataUri } from "@/lib/glow-billboard";
import { useUiStore } from "@/lib/store";

// Natural Earth 1:110m populated places, pre-filtered to ADM0CAP === 1
// (national capitals only, 199 of them) — same trusted source as the
// country-borders GeoJSON, bundled once at build time. REST Countries
// (the API this was originally planned against) turned out to require an
// API key as of its v5 migration; Natural Earth needs no key and no server.
const CAPITALS_URL = "/data/capitals.geojson";

// Only show the city name once the camera is close enough that ~200 labels
// wouldn't blanket the whole globe — the glow dot alone is what's visible
// at whole-globe zoom.
const LABEL_DISTANCE = new DistanceDisplayCondition(0, 4_000_000);

interface Capital {
  name: string;
  country: string;
  longitude: number;
  latitude: number;
}

interface CapitalFeature {
  geometry: { coordinates: [number, number] };
  properties: { name: string; country: string };
}

export function PlacesLayer() {
  const [capitals, setCapitals] = useState<Capital[] | null>(null);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  useEffect(() => {
    let cancelled = false;
    fetch(CAPITALS_URL)
      .then((res) => res.json())
      .then((geojson: { features: CapitalFeature[] }) => {
        if (cancelled) return;
        setCapitals(
          geojson.features.map((f) => ({
            name: f.properties.name,
            country: f.properties.country,
            longitude: f.geometry.coordinates[0],
            latitude: f.geometry.coordinates[1],
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!capitals) return null;

  return (
    <>
      {capitals.map((capital) => (
        <Entity
          key={`${capital.name}-${capital.country}`}
          position={Cartesian3.fromDegrees(capital.longitude, capital.latitude)}
          name={capital.name}
          onClick={() =>
            setSelectedEvent({
              kind: "place",
              title: capital.name,
              attributes: [{ label: "Country", value: capital.country }],
              latitude: capital.latitude,
              longitude: capital.longitude,
            })
          }
        >
          <BillboardGraphics image={getGlowDataUri()} color={Color.WHITE.withAlpha(0.7)} width={10} height={10} />
          <LabelGraphics
            text={capital.name}
            font="11px monospace"
            fillColor={Color.WHITE}
            pixelOffset={new Cartesian2(0, -12)}
            showBackground
            backgroundColor={Color.BLACK.withAlpha(0.5)}
            distanceDisplayCondition={LABEL_DISTANCE}
          />
        </Entity>
      ))}
    </>
  );
}
