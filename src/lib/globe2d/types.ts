import type { GeoPath, GeoProjection } from "d3";
import type { SelectedEvent } from "@/lib/store";

/** Shared render context every layer's draw() receives. */
export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  projection: GeoProjection;
  path: GeoPath;
  /** currentScale / baseRadius — use to keep stroke widths/marker sizes constant on-screen while zooming. */
  scaleFactor: number;
  width: number;
  height: number;
  isFrontFacing: (lng: number, lat: number) => boolean;
}

/** One hoverable/clickable screen-space target, produced fresh every render since projection changes with rotation/zoom. */
export interface HitCandidate {
  screenX: number;
  screenY: number;
  screenRadius: number;
  label: string;
  detail?: string;
  /** Present = click opens EventDetailPanel. Absent = hover-only (matches Cesium entities with a name but no onClick). */
  toSelectedEvent?: () => SelectedEvent;
  /** Present (and toSelectedEvent absent) = click zooms the globe in on this point instead of selecting — used by cluster markers. */
  flyTo?: { latitude: number; longitude: number };
}
