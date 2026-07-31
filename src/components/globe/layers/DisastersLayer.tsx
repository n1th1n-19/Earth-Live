"use client";

import { Cartesian2, Cartesian3, Color, LabelStyle, NearFarScalar } from "cesium";
import { BillboardGraphics, Entity, LabelGraphics } from "resium";
import { useDisasters } from "@/lib/use-disasters";
import { getGlowDataUri } from "@/lib/glow-billboard";
import { useUiStore } from "@/lib/store";
import type { Disaster } from "@/lib/adapters/gdacs";

// GDACS Orange/Red humanitarian-impact alerts — floods, cyclones, droughts,
// volcanoes, wildfires and high-impact quakes worldwide.
//
// Not clustered, unlike wildfires: there are only ~100 of these globally and
// each one is individually significant, so collapsing them into count badges
// would hide exactly the events the layer exists to show.
//
// Red is a deeper, more saturated marker than Orange, but severity is never
// carried by colour alone — the alert level is written into the label and the
// detail panel (docs/04-ui-ux-spec.md §4.5).
const ALERT_COLOR: Record<Disaster["alertLevel"], Color> = {
  Red: Color.fromCssColorString("#ff3b30"),
  Orange: Color.fromCssColorString("#ff9f0a"),
};

// Labels would overlap badly at whole-globe zoom, so they fade in as the
// camera approaches — same treatment as the capitals layer.
const LABEL_SCALE = new NearFarScalar(1.5e6, 1.0, 1.2e7, 0.0);

export function DisastersLayer() {
  const { data } = useDisasters();
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);

  if (!data) return null;

  return (
    <>
      {data.map((disaster) => {
        const color = ALERT_COLOR[disaster.alertLevel];
        // Red alerts read slightly larger as a second, redundant channel.
        const size = disaster.alertLevel === "Red" ? 40 : 30;

        return (
          <Entity
            key={disaster.id}
            position={Cartesian3.fromDegrees(disaster.longitude, disaster.latitude)}
            name={`${disaster.typeLabel} · ${disaster.alertLevel} alert`}
            description={
              disaster.country
                ? `${disaster.title} — ${disaster.country}`
                : disaster.title
            }
            onClick={() => setSelectedEvent(toSelectedEvent(disaster))}
          >
            <BillboardGraphics
              image={getGlowDataUri()}
              color={color.withAlpha(0.9)}
              width={size}
              height={size}
            />
            <LabelGraphics
              text={disaster.typeLabel}
              font="11px monospace"
              fillColor={color}
              outlineColor={Color.BLACK}
              outlineWidth={3}
              style={LabelStyle.FILL_AND_OUTLINE}
              pixelOffset={new Cartesian2(0, -18)}
              scaleByDistance={LABEL_SCALE}
              translucencyByDistance={LABEL_SCALE}
            />
          </Entity>
        );
      })}
    </>
  );
}

function toSelectedEvent(disaster: Disaster) {
  const attributes = [
    { label: "Type", value: disaster.typeLabel },
    { label: "Alert level", value: disaster.alertLevel },
  ];
  if (disaster.country) attributes.push({ label: "Country", value: disaster.country });
  if (disaster.severityText) attributes.push({ label: "Severity", value: disaster.severityText });
  if (disaster.fromDate) {
    attributes.push({ label: "Since", value: new Date(disaster.fromDate).toLocaleDateString() });
  }

  return {
    kind: "disaster" as const,
    title: disaster.title,
    attributes,
    latitude: disaster.latitude,
    longitude: disaster.longitude,
  };
}
