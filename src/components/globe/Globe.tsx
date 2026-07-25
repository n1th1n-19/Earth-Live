"use client";

// Side-effect import must run before any other cesium/resium import — see
// src/lib/cesium-base-url.ts.
import "@/lib/cesium-base-url";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Named imports (not `import * as Cesium`) — Cesium's own bundle-size
// guidance: this doesn't shrink the dev-mode Turbopack chunk (which
// includes the whole engine unminified either way), but it's a genuine,
// low-risk win for the minified production bundle's tree-shaking.
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  createWorldImageryAsync,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Ion,
  IonWorldImageryStyle,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
} from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, PointGraphics, PolylineGraphics, Viewer } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import { useUiStore } from "@/lib/store";
import { totalPathDistanceKm, type LatLon } from "@/lib/geo-math";
import { formatDistanceKm } from "@/lib/units";
import { FloatingControls } from "@/components/globe/FloatingControls";
import { EarthquakeLayer } from "@/components/globe/layers/EarthquakeLayer";
import { FlightsLayer } from "@/components/globe/layers/FlightsLayer";
import { IssLayer } from "@/components/globe/layers/IssLayer";
import { WildfireLayer } from "@/components/globe/layers/WildfireLayer";

// Primary globe engine per docs/03-architecture.md §3.2: CesiumJS, chosen for
// its native WGS84 globe, real-time sun/lighting, and terrain streaming.
//
// Base imagery is satellite (Cesium ion's world imagery, Bing Maps Aerial —
// free ion tier) when NEXT_PUBLIC_CESIUM_ION_TOKEN is configured, falling
// back to free OpenStreetMap raster tiles (no key, attribution required —
// docs/05-api-integration-guide.md §5.5) if it isn't. Terrain is still the
// default ellipsoid regardless — that's a separate swap
// (docs/05-api-integration-guide.md §5.9), not requested here.
const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
if (ionToken) {
  Ion.defaultAccessToken = ionToken;
}

// EllipsoidTerrainProvider is stateless (pure math, no GPU resources) so a
// module-level singleton is fine. The imagery layer is NOT — Cesium caches
// WebGL textures inside it that are bound to whichever Viewer/context last
// used it, so sharing one instance across remounts (React Fast Refresh, a
// StrictMode double-mount) throws "bindTexture: object does not belong to
// this context" once a second Viewer's context tries to reuse it. It's
// created fresh per Globe instance below instead.
const ellipsoidTerrain = new EllipsoidTerrainProvider();

interface GlobeProps {
  latitude: number | null;
  longitude: number | null;
}

export function Globe({ latitude, longitude }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ cesiumElement?: CesiumViewer }>(null);
  const hasFlownRef = useRef(false);

  // A destroyed Cesium Viewer isn't null — `.destroy()` just nulls its
  // internal `_cesiumWidget`, so `viewerRef.current?.cesiumElement` alone
  // doesn't catch it (throws "can't access property 'scene', this.
  // _cesiumWidget is undefined" on the next camera call). Happens whenever
  // the Viewer gets torn down and recreated — dev Fast Refresh, a Resium
  // read-only-prop recreate — and a stale ref outlives the old instance
  // until the new one is provided. Single guarded accessor for every
  // imperative call site below.
  function getLiveViewer(): CesiumViewer | null {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return null;
    return viewer;
  }

  // Cesium's `creditContainer` is a construction-time-only option in
  // Resium (it doesn't react to prop changes after mount), so this must be
  // a real DOM node available synchronously on first render — not a ref
  // populated later via commit, which would still be null when Resium
  // constructs the Cesium.Viewer. Doesn't need to be attached to the
  // visible tree; Cesium only needs somewhere to put credit nodes.
  const hiddenCreditsContainer = useMemo(() => {
    if (typeof document === "undefined") return undefined;
    const el = document.createElement("div");
    el.style.display = "none";
    return el;
  }, []);

  const activeLayers = useUiStore((s) => s.activeLayers);
  const units = useUiStore((s) => s.units);
  const setCameraPosition = useUiStore((s) => s.setCameraPosition);
  const setCursorCoordinates = useUiStore((s) => s.setCursorCoordinates);
  const flyToTarget = useUiStore((s) => s.flyToTarget);
  const clearFlyTo = useUiStore((s) => s.clearFlyTo);

  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLon[]>([]);

  // Fresh per mount — see the comment on `ellipsoidTerrain` above. Satellite
  // imagery via ion when a token is configured; ImageryLayer.fromProviderAsync
  // accepts the provider promise directly, no need to await it here.
  const baseImageryLayer = useMemo(
    () =>
      ionToken
        ? ImageryLayer.fromProviderAsync(createWorldImageryAsync({ style: IonWorldImageryStyle.AERIAL }))
        : new ImageryLayer(
            new OpenStreetMapImageryProvider({
              url: "https://tile.openstreetmap.org/",
              credit: "© OpenStreetMap contributors",
            }),
          ),
    [],
  );

  // Real-time day/night terminator (FR-1) — Cesium computes this from actual
  // sun position once lighting is enabled; no custom math needed.
  useEffect(() => {
    const viewer = getLiveViewer();
    if (viewer) {
      viewer.scene.globe.enableLighting = true;
    }
  }, []);

  // FR-25/26: sample camera pose on moveEnd for share-URL encoding
  // (src/lib/view-state.ts / page.tsx).
  useEffect(() => {
    const viewer = getLiveViewer();
    if (!viewer) return;

    function sampleCamera() {
      if (!viewer || viewer.isDestroyed()) return;
      const cartographic = viewer.camera.positionCartographic;
      setCameraPosition({
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        height: cartographic.height,
      });
    }

    viewer.camera.moveEnd.addEventListener(sampleCamera);
    return () => {
      if (!viewer.isDestroyed()) viewer.camera.moveEnd.removeEventListener(sampleCamera);
    };
  }, [setCameraPosition]);

  useEffect(() => {
    const viewer = getLiveViewer();
    if (!viewer || latitude == null || longitude == null || hasFlownRef.current) return;

    hasFlownRef.current = true;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, 1_500_000),
      duration: 2,
    });
  }, [latitude, longitude]);

  // Command palette / search "fly to" requests (FR-12) and the recenter
  // control both funnel through the same store field.
  useEffect(() => {
    const viewer = getLiveViewer();
    if (!viewer || !flyToTarget) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        flyToTarget.longitude,
        flyToTarget.latitude,
        flyToTarget.height ?? 1_000_000,
      ),
      duration: 1.5,
    });
    clearFlyTo();
  }, [flyToTarget, clearFlyTo]);

  function pickEllipsoidCoordinates(windowPosition: Cartesian2): LatLon | null {
    const viewer = getLiveViewer();
    if (!viewer) return null;
    const cartesian = viewer.camera.pickEllipsoid(windowPosition, viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const cartographic = Cartographic.fromCartesian(cartesian);
    return {
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      longitude: CesiumMath.toDegrees(cartographic.longitude),
    };
  }

  function handleMouseMove(movement: { endPosition?: Cartesian2 }) {
    if (!movement.endPosition) return;
    const coords = pickEllipsoidCoordinates(movement.endPosition);
    setCursorCoordinates(coords);
  }

  function handleClick(movement: { position?: Cartesian2 }) {
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
    getLiveViewer()?.camera.zoomIn();
  }

  function zoomOut() {
    getLiveViewer()?.camera.zoomOut();
  }

  // docs/04-ui-ux-spec.md §4.6: "+ / - | Zoom in/out", plus WASD fly
  // controls. Reads viewerRef directly rather than calling zoomIn/zoomOut so
  // the effect can mount once with an empty dep array — those two are plain
  // functions redefined every render, not stable callbacks. WASD move
  // distance scales with camera height so panning feels consistent whether
  // zoomed to street level or the whole globe; the browser's native
  // key-repeat on a held key gives continuous movement for free.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const viewer = getLiveViewer();
      if (!viewer) return;

      if (e.key === "+" || e.key === "=") {
        viewer.camera.zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        viewer.camera.zoomOut();
      } else {
        const moveRate = viewer.camera.positionCartographic.height * 0.02;
        switch (e.key.toLowerCase()) {
          case "w":
            viewer.camera.moveForward(moveRate);
            break;
          case "s":
            viewer.camera.moveBackward(moveRate);
            break;
          case "a":
            viewer.camera.moveLeft(moveRate);
            break;
          case "d":
            viewer.camera.moveRight(moveRate);
            break;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function recenter() {
    if (latitude == null || longitude == null) return;
    getLiveViewer()?.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, 1_500_000),
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
    const canvas = getLiveViewer()?.scene.canvas;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `earth-live-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Resium treats `contextOptions` as construction-time-only — an inline
  // object literal gets a new reference every render, which Resium reads as
  // "the prop changed" and destroys + recreates the entire Viewer (WebGL
  // context, terrain, imagery, every entity) on every re-render of Globe.
  // That's what "<Viewer> is recreated because..." in the console meant, and
  // why zoomIn/zoomOut/recenter/screenshot then threw on a mid-teardown
  // cesiumElement. Same stable-reference treatment as hiddenCreditsContainer
  // and baseImageryLayer above.
  const contextOptions = useMemo(() => ({ webgl: { preserveDrawingBuffer: true } }), []);

  const measureDistanceKm = totalPathDistanceKm(measurePoints);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Viewer
        ref={viewerRef}
        full
        baseLayer={baseImageryLayer}
        terrainProvider={ellipsoidTerrain}
        contextOptions={contextOptions}
        creditContainer={hiddenCreditsContainer}
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
        {activeLayers.includes("wildfires") && <WildfireLayer />}

        {measurePoints.map((point, i) => (
          <Entity key={i} position={Cartesian3.fromDegrees(point.longitude, point.latitude)}>
            <PointGraphics pixelSize={8} color={Color.LIME} outlineColor={Color.BLACK} outlineWidth={1} />
          </Entity>
        ))}
        {measurePoints.length >= 2 && (
          <Entity>
            <PolylineGraphics
              positions={Cartesian3.fromDegreesArray(
                measurePoints.flatMap((p) => [p.longitude, p.latitude]),
              )}
              width={2}
              material={Color.LIME}
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
            : formatDistanceKm(measureDistanceKm, units)}
        </div>
      )}
    </div>
  );
}
