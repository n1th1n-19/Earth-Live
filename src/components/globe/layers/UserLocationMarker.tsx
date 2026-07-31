"use client";

import { useMemo } from "react";
import { Cartesian2, Cartesian3, Color } from "cesium";
import { Entity, LabelGraphics, PointGraphics } from "resium";

interface UserLocationMarkerProps {
  latitude: number | null;
  longitude: number | null;
}

// Marks wherever the user actually resolved to — real GPS if they granted
// permission, otherwise the coarse IP hint (src/lib/geolocation.ts). Purely
// a marker: the camera is deliberately left alone, so granting location
// permission no longer yanks the view down out of the global view.
export function UserLocationMarker({ latitude, longitude }: UserLocationMarkerProps) {
  const position = useMemo(
    () => (latitude == null || longitude == null ? null : Cartesian3.fromDegrees(longitude, latitude)),
    [latitude, longitude],
  );

  if (!position) return null;

  return (
    <Entity position={position} name="Your location">
      <PointGraphics
        pixelSize={12}
        color={Color.DODGERBLUE}
        outlineColor={Color.WHITE}
        outlineWidth={2}
        // Without this the marker is hidden by the globe surface it sits on
        // at shallow camera angles.
        disableDepthTestDistance={Number.POSITIVE_INFINITY}
      />
      <LabelGraphics
        text="You are here"
        font="12px monospace"
        fillColor={Color.WHITE}
        pixelOffset={new Cartesian2(0, -18)}
        showBackground
        backgroundColor={Color.BLACK.withAlpha(0.6)}
        disableDepthTestDistance={Number.POSITIVE_INFINITY}
      />
    </Entity>
  );
}
