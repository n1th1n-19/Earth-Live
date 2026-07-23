"use client";

// Side-effect import must run before any other cesium/resium import — see
// src/lib/cesium-base-url.ts.
import "@/lib/cesium-base-url";
import "cesium/Build/Cesium/Widgets/widgets.css";

import * as Cesium from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, PointGraphics, PolylineGraphics, Viewer } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import { useUiStore } from "@/lib/store";
import { totalPathDistanceKm, type LatLon } from "@/lib/geo-math";
import { FloatingControls } from "@/components/globe/FloatingControls";
import { EarthquakeLayer } from "@/components/globe/layers/EarthquakeLayer";
import { FlightsLayer } from "@/components/globe/layers/FlightsLayer";
import { IssLayer } from "@/components/globe/layers/IssLayer";

// Primary globe engine per docs/03-architecture.md §3.2: CesiumJS, chosen for
// its native WGS84 globe, real-time sun/lighting, and terrain streaming.
//
// This slice uses free OpenStreetMap raster tiles (no key, attribution
// required — docs/05-api-integration-guide.md §5.5) and the default
// ellipsoid terrain (no Cesium ion token configured yet). Swap in Cesium
// World Terrain once NEXT_PUBLIC_CESIUM_ION_TOKEN is provisioned
// (docs/05-api-integration-guide.md §5.9).
//
// EllipsoidTerrainProvider is stateless (pure math, no GPU resources) so a
// module-level singleton is fine. The imagery layer is NOT — Cesium caches
// WebGL textures inside it that are bound to whichever Viewer/context last
// used it, so sharing one instance across remounts (React Fast Refresh, a
// StrictMode double-mount) throws "bindTexture: object does not belong to
// this context" once a second Viewer's context tries to reuse it. It's
// created fresh per Globe instance below instead.
const ellipsoidTerrain = new Cesium.EllipsoidTerrainProvider();

interface GlobeProps {
  latitude: number | null;
  longitude: number | null;
}

export function Globe({ latitude, longitude }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ cesiumElement?: CesiumViewer }>(null);
  const hasFlownRef = useRef(false);

  const activeLayers = useUiStore((s) => s.activeLayers);
  const setCursorCoordinates = useUiStore((s) => s.setCursorCoordinates);
  const flyToTarget = useUiStore((s) => s.flyToTarget);
  const clearFlyTo = useUiStore((s) => s.clearFlyTo);

  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLon[]>([]);

  // Fresh per mount — see the comment on `ellipsoidTerrain` above.
  const osmImageryLayer = useMemo(
    () =>
      new Cesium.ImageryLayer(
        new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
          credit: "© OpenStreetMap contributors",
        }),
      ),
    [],
  );

  // Real-time day/night terminator (FR-1) — Cesium computes this from actual
  // sun position once lighting is enabled; no custom math needed.
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer) {
      viewer.scene.globe.enableLighting = true;
    }
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || latitude == null || longitude == null || hasFlownRef.current) return;

    hasFlownRef.current = true;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1_500_000),
      duration: 2,
    });
  }, [latitude, longitude]);

  // Command palette / search "fly to" requests (FR-12) and the recenter
  // control both funnel through the same store field.
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !flyToTarget) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(flyToTarget.longitude, flyToTarget.latitude, 1_000_000),
      duration: 1.5,
    });
    clearFlyTo();
  }, [flyToTarget, clearFlyTo]);

  function pickEllipsoidCoordinates(windowPosition: Cesium.Cartesian2): LatLon | null {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return null;
    const cartesian = viewer.camera.pickEllipsoid(windowPosition, viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
    };
  }

  function handleMouseMove(movement: { endPosition?: Cesium.Cartesian2 }) {
    if (!movement.endPosition) return;
    const coords = pickEllipsoidCoordinates(movement.endPosition);
    setCursorCoordinates(coords);
  }

  function handleClick(movement: { position?: Cesium.Cartesian2 }) {
    if (!measuring || !movement.position) return;
    const coords = pickEllipsoidCoordinates(movement.position);
    if (coords) setMeasurePoints((prev) => [...prev, coords]);
  }

  function toggleMeasuring() {
    setMeasuring((prev) => {
      if (prev) setMeasurePoints([]);
      return !prev;
    });
  }

  function zoomIn() {
    viewerRef.current?.cesiumElement?.camera.zoomIn();
  }

  function zoomOut() {
    viewerRef.current?.cesiumElement?.camera.zoomOut();
  }

  function recenter() {
    if (latitude == null || longitude == null) return;
    viewerRef.current?.cesiumElement?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1_500_000),
      duration: 1.5,
    });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  function screenshot() {
    const canvas = viewerRef.current?.cesiumElement?.scene.canvas;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `earth-live-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const measureDistanceKm = totalPathDistanceKm(measurePoints);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Viewer
        ref={viewerRef}
        full
        baseLayer={osmImageryLayer}
        terrainProvider={ellipsoidTerrain}
        contextOptions={{ webgl: { preserveDrawingBuffer: true } }}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        fullscreenButton={false}
        infoBox={false}
        selectionIndicator={false}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        {activeLayers.includes("earthquakes") && <EarthquakeLayer />}
        {activeLayers.includes("flights") && <FlightsLayer />}
        {activeLayers.includes("iss") && <IssLayer />}

        {measurePoints.map((point, i) => (
          <Entity key={i} position={Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude)}>
            <PointGraphics pixelSize={8} color={Cesium.Color.LIME} outlineColor={Cesium.Color.BLACK} outlineWidth={1} />
          </Entity>
        ))}
        {measurePoints.length >= 2 && (
          <Entity>
            <PolylineGraphics
              positions={Cesium.Cartesian3.fromDegreesArray(
                measurePoints.flatMap((p) => [p.longitude, p.latitude]),
              )}
              width={2}
              material={Cesium.Color.LIME}
              clampToGround
            />
          </Entity>
        )}
      </Viewer>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10">
        <FloatingControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onRecenter={recenter}
          onToggleFullscreen={toggleFullscreen}
          onScreenshot={screenshot}
          onToggleMeasuring={toggleMeasuring}
          measuring={measuring}
        />
      </div>

      {measuring && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-xs text-emerald-300 backdrop-blur-xl">
          {measurePoints.length < 2
            ? "Click two or more points to measure"
            : `${measureDistanceKm.toFixed(1)} km`}
        </div>
      )}
    </div>
  );
}
