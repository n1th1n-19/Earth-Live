"use client";

import { useEffect, useState } from "react";
import { Cartesian2, Cartesian3, Color, DistanceDisplayCondition } from "cesium";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { getGlowDataUri } from "@/lib/glow-billboard";
import { useUiStore } from "@/lib/store";

// Smithsonian Global Volcanism Program's Holocene volcano list — free,
// keyless, verified live (1196 real volcanoes, including known-active ones
// like Etna/Kilauea/Fuji), bundled once at build time same as the capitals
// and country-borders GeoJSON.
const VOLCANOES_URL = "/data/volcanoes.geojson";

// Recently active reads as a brighter, warmer glow — a real signal from the
// data (a real eruption year within living memory), not decoration. The rest
// still show, just dimmer, since "no eruption on record" is itself real
// information about a Holocene volcano.
const RECENT_ERUPTION_CUTOFF_YEAR = new Date().getFullYear() - 100;

const LABEL_DISTANCE = new DistanceDisplayCondition(0, 3_000_000);

interface Volcano {
  name: string;
  volcanoType: string | null;
  country: string | null;
  lastEruptionYear: number | null;
  elevationM: number | null;
  longitude: number;
  latitude: number;
}

interface VolcanoFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name: string;
    type: string | null;
    country: string | null;
    lastEruptionYear: number | null;
    elevationM: number | null;
  };
}

function isRecentlyActive(year: number | null): boolean {
  return year != null && year >= RECENT_ERUPTION_CUTOFF_YEAR;
}

function formatEruptionYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function VolcanoesLayer() {
  const [volcanoes, setVolcanoes] = useState<Volcano[] | null>(null);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  useEffect(() => {
    let cancelled = false;
    fetch(VOLCANOES_URL)
      .then((res) => res.json())
      .then((geojson: { features: VolcanoFeature[] }) => {
        if (cancelled) return;
        setVolcanoes(
          geojson.features.map((f) => ({
            name: f.properties.name,
            volcanoType: f.properties.type,
            country: f.properties.country,
            lastEruptionYear: f.properties.lastEruptionYear,
            elevationM: f.properties.elevationM,
            longitude: f.geometry.coordinates[0],
            latitude: f.geometry.coordinates[1],
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!volcanoes) return null;

  return (
    <>
      {volcanoes.map((volcano) => {
        const active = isRecentlyActive(volcano.lastEruptionYear);
        const color = active ? Color.ORANGERED.withAlpha(0.95) : Color.ORANGERED.withAlpha(0.4);
        const size = active ? 22 : 14;

        const attributes = [
          { label: "Type", value: volcano.volcanoType ?? "Unknown" },
          {
            label: "Last eruption",
            value: volcano.lastEruptionYear != null ? formatEruptionYear(volcano.lastEruptionYear) : "Undated",
          },
        ];
        if (volcano.country) attributes.push({ label: "Country", value: volcano.country });
        if (volcano.elevationM != null) {
          attributes.push({ label: "Elevation", value: `${volcano.elevationM.toLocaleString()} m` });
        }

        return (
          <Entity
            key={`${volcano.name}-${volcano.latitude}-${volcano.longitude}`}
            position={Cartesian3.fromDegrees(volcano.longitude, volcano.latitude)}
            name={volcano.name}
            description={volcano.volcanoType ?? "Volcano"}
            onClick={() =>
              setSelectedEvent({
                kind: "volcano",
                title: volcano.name,
                attributes,
                latitude: volcano.latitude,
                longitude: volcano.longitude,
              })
            }
          >
            <BillboardGraphics image={getGlowDataUri()} color={color} width={size} height={size} />
            <LabelGraphics
              text={volcano.name}
              font="11px monospace"
              fillColor={Color.ORANGE}
              pixelOffset={new Cartesian2(0, -14)}
              showBackground
              backgroundColor={Color.BLACK.withAlpha(0.5)}
              distanceDisplayCondition={LABEL_DISTANCE}
            />
          </Entity>
        );
      })}
    </>
  );
}
