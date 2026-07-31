"use client";

import { Cartesian3, Color } from "cesium";
import { Entity, PolygonGraphics, PolylineGraphics } from "resium";
import { useWeatherAlerts } from "@/lib/use-weather-alerts";
import { useUiStore } from "@/lib/store";
import type { WeatherAlert } from "@/lib/adapters/nws-alerts";

// US National Weather Service Extreme/Severe alerts, drawn as their real
// warning polygons rather than points — the shape *is* the information here.
//
// Coverage is partial by design: most active NWS alerts carry no geometry and
// describe their area by zone reference instead, so only polygon-bearing
// alerts appear (see src/lib/adapters/nws-alerts.ts). The layer label says
// "US severe (mapped)" so this isn't read as every warning in effect.
const SEVERITY_COLOR: Record<WeatherAlert["severity"], Color> = {
  Extreme: Color.fromCssColorString("#ff2d55"),
  Severe: Color.fromCssColorString("#ffb340"),
};

export function WeatherAlertsLayer() {
  const { data } = useWeatherAlerts();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  if (!data) return null;

  return (
    <>
      {data.map((alert) =>
        alert.rings.map((ring, index) => {
          const color = SEVERITY_COLOR[alert.severity];
          const positions = Cartesian3.fromDegreesArray(ring);

          return (
            <Entity
              // A MultiPolygon alert contributes one entity per part, so the
              // ring index has to be part of the key.
              key={`${alert.id}-${index}`}
              name={`${alert.event} · ${alert.severity}`}
              description={alert.areaDesc ?? alert.headline ?? alert.event}
              onClick={() => setSelectedEvent(toSelectedEvent(alert))}
            >
              {/* Fill stays faint so overlapping warnings remain readable and
                  the globe underneath still shows through. */}
              <PolygonGraphics hierarchy={positions} material={color.withAlpha(0.22)} />
              {/* The outline carries the shape; polygon outlines ignore width
                  on most platforms, so it's a separate polyline. */}
              <PolylineGraphics positions={positions} width={2} material={color} clampToGround={false} />
            </Entity>
          );
        }),
      )}
    </>
  );
}

function toSelectedEvent(alert: WeatherAlert) {
  const attributes = [
    { label: "Event", value: alert.event },
    { label: "Severity", value: alert.severity },
  ];
  if (alert.areaDesc) attributes.push({ label: "Area", value: alert.areaDesc });
  if (alert.senderName) attributes.push({ label: "Issued by", value: alert.senderName });
  if (alert.expires) {
    attributes.push({ label: "Expires", value: new Date(alert.expires).toLocaleString() });
  }

  return {
    kind: "alert" as const,
    title: alert.headline ?? alert.event,
    attributes,
    latitude: alert.latitude,
    longitude: alert.longitude,
  };
}
