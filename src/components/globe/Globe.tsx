"use client";

// Cesium needs window.CESIUM_BASE_URL to find its Workers/Assets/ThirdParty/
// Widgets (copied to public/cesium by scripts/copy-cesium-assets.mjs) — read
// lazily inside Cesium's own getCesiumBaseUrl(), only when it first resolves
// a resource URL at runtime, not synchronously at module-import time (traced
// into node_modules/cesium/Build/CesiumUnminified/index.js to confirm), so
// import order relative to `cesium` doesn't matter. This used to live in its
// own side-effect-only module (`import "@/lib/cesium-base-url"`), which
// `next build`'s tree-shaking silently dropped in production — confirmed by
// grepping the deployed bundle for the string and finding it nowhere, which
// left Cesium unable to find its own Workers and made every worker spawn
// fail instantly with "Connection closed", stuck forever on "Loading
// globe…". Inlined here instead, in a module proven not to be eliminated
// since it renders real UI.
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

if (typeof window !== "undefined") {
  window.CESIUM_BASE_URL = "/cesium/";
}

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
  EllipsoidTerrainProvider,
  Math as CesiumMath,
} from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, PointGraphics, PolylineGraphics, Viewer } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import { useUiStore } from "@/lib/store";
import { totalPathDistanceKm, type LatLon } from "@/lib/geo-math";
import { formatDistanceKm } from "@/lib/units";
import { FloatingControls } from "@/components/globe/FloatingControls";
import { GlobeTooltip, type HoverTarget } from "@/components/globe/GlobeTooltip";
import { AuroraLayer } from "@/components/globe/layers/AuroraLayer";
import { BordersLayer } from "@/components/globe/layers/BordersLayer";
import { UserLocationMarker } from "@/components/globe/layers/UserLocationMarker";
import { EarthquakeLayer } from "@/components/globe/layers/EarthquakeLayer";
import { FlightsLayer } from "@/components/globe/layers/FlightsLayer";
import { IssLayer } from "@/components/globe/layers/IssLayer";
import { DisastersLayer } from "@/components/globe/layers/DisastersLayer";
import { PlacesLayer } from "@/components/globe/layers/PlacesLayer";
import { WildfireLayer } from "@/components/globe/layers/WildfireLayer";

// Primary globe engine per docs/03-architecture.md §3.2: CesiumJS, chosen for
// its native WGS84 globe, real-time sun/lighting, and terrain streaming.
//
// Wireframe look: a flat black globe with no imagery, real country borders
// (Natural Earth 1:110m, public domain — public/data/ne_110m_admin_0_countries.geojson,
// bundled static rather than fetched from GitHub at runtime). No ion token,
// no photoreal imagery/terrain — that whole path (Bing aerial, real terrain
// relief, GIBS clouds/night-lights) was removed in favor of this; see git
// history and TODO.md if it's ever wanted back.
//
// EllipsoidTerrainProvider is stateless (pure math, no GPU resources) so a
// module-level singleton is fine — same flat sphere the wireframe reference
// image shows, no relief needed.
const ellipsoidTerrain = new EllipsoidTerrainProvider();

// Whole-globe framing — the view the app opens on, and where it stays when
// the user's location resolves.
const GLOBAL_VIEW_HEIGHT_M = 20_000_000;

// One rotation per sidereal day: the Earth's real rotation period relative
// to the fixed stars (86,164.0905s), not the 86,400s mean solar day.
const SIDEREAL_DAY_SECONDS = 86_164.0905;
const EARTH_ROTATION_RAD_PER_SEC = (2 * Math.PI) / SIDEREAL_DAY_SECONDS;

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
  const earthRotation = useUiStore((s) => s.earthRotation);

  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLon[]>([]);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  // Latest un-picked cursor position, and the frame scheduled to pick it —
  // see handleMouseMove.
  const pendingHoverRef = useRef<Cartesian2 | null>(null);
  const hoverFrameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
    },
    [],
  );

  // Real-time day/night terminator (FR-1) — Cesium computes this from actual
  // sun position once lighting is enabled; no custom math needed. Kept even
  // without imagery: it's real data, not photoreal-specific. baseColor is
  // the wireframe look's black globe surface.
  //
  // Resium's async Viewer construction (queueMicrotask + await inside
  // mount()) isn't guaranteed to have populated viewerRef.current by the
  // time this effect's single [] pass runs — confirmed live: the globe
  // rendered Cesium's default blue, meaning this silently no-op'd on first
  // mount. Unlike the moveEnd/cinematic-flyby effects below, this one has no
  // prop (like latitude/longitude) that changes after mount to give it a
  // natural second attempt, so it needs its own retry until the ref is live.
  useEffect(() => {
    let cancelled = false;
    function apply() {
      if (cancelled) return;
      const viewer = getLiveViewer();
      if (!viewer) {
        requestAnimationFrame(apply);
        return;
      }
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.baseColor = Color.BLACK;
    }
    apply();
    return () => {
      cancelled = true;
    };
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

  // Resolving the user's location only re-centres the globe on them — it no
  // longer zooms in. Granting location permission used to trigger a 3s fly
  // down to 1,500km, which yanked the user out of the whole-globe view they
  // were looking at; the location is now shown by UserLocationMarker instead
  // (an explicit "Recenter on my location" control still exists for when a
  // close-up actually is wanted).
  //
  // Retries on animation frames until the Viewer exists, for the same reason
  // the lighting effect above does: Resium builds it asynchronously, so when
  // geolocation resolves before that finishes this would otherwise no-op
  // once and never re-centre.
  useEffect(() => {
    if (latitude == null || longitude == null || hasFlownRef.current) return;

    let cancelled = false;
    function apply() {
      if (cancelled || latitude == null || longitude == null) return;
      const viewer = getLiveViewer();
      if (!viewer) {
        requestAnimationFrame(apply);
        return;
      }
      hasFlownRef.current = true;
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(longitude, latitude, GLOBAL_VIEW_HEIGHT_M),
      });
    }
    apply();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  // Real-time Earth rotation. Cesium's globe is fixed to the Earth-centred
  // frame, so "the Earth spinning" is expressed by orbiting the camera
  // westward at the planet's true angular rate. That rate is one turn per
  // sidereal day (86,164s — the real rotation period against the stars, not
  // the 86,400s solar day), i.e. ~15°/hour: correct, and therefore slow
  // enough to read as drift rather than a spin.
  //
  // Paused while the user is interacting or a fly-to is running, otherwise
  // it would fight their input; resumes once the camera settles.
  useEffect(() => {
    if (!earthRotation) return;
    let frame = 0;
    let last = performance.now();

    function tick(now: number) {
      const viewer = getLiveViewer();
      if (viewer && !viewer.scene.screenSpaceCameraController.enableInputs) {
        last = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      if (viewer) {
        const elapsedSeconds = (now - last) / 1000;
        viewer.camera.rotate(Cartesian3.UNIT_Z, -EARTH_ROTATION_RAD_PER_SEC * elapsedSeconds);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [earthRotation]);

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

  // Hover readout: whatever entity is under the cursor identifies itself via
  // its own `name`/`description`, so this works for every layer (flights,
  // ISS, quakes, fires, capitals) without per-layer wiring.
  //
  // scene.pick renders an offscreen pick pass, which is far too expensive to
  // run on every mousemove — the browser fires those faster than frames. Only
  // the most recent cursor position is kept, and it's picked once per frame.
  function runHoverPick(position: Cartesian2) {
    const viewer = getLiveViewer();
    if (!viewer) return;
    const picked = viewer.scene.pick(position);
    const entity = picked?.id;
    const label = typeof entity?.name === "string" ? entity.name : null;
    if (!label) {
      setHoverTarget(null);
      return;
    }
    // Entity.description is a Cesium Property, not a bare string — each
    // layer sets it to a one-line summary for exactly this readout.
    const description = entity?.description?.getValue?.(viewer.clock.currentTime);
    setHoverTarget({
      label,
      detail: typeof description === "string" ? description : undefined,
      x: position.x,
      y: position.y,
    });
  }

  function handleMouseMove(movement: { endPosition?: Cartesian2 }) {
    if (!movement.endPosition) return;
    const coords = pickEllipsoidCoordinates(movement.endPosition);
    setCursorCoordinates(coords);

    pendingHoverRef.current = movement.endPosition.clone();
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const position = pendingHoverRef.current;
      if (position) runHoverPick(position);
    });
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
  // above.
  const contextOptions = useMemo(() => ({ webgl: { preserveDrawingBuffer: true } }), []);

  const measureDistanceKm = totalPathDistanceKm(measurePoints);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Viewer
        ref={viewerRef}
        full
        baseLayer={false}
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
        <BordersLayer />
        <UserLocationMarker latitude={latitude} longitude={longitude} />
        <AuroraLayer />

        {activeLayers.includes("earthquakes") && <EarthquakeLayer />}
        {activeLayers.includes("flights") && <FlightsLayer />}
        {activeLayers.includes("iss") && <IssLayer />}
        {activeLayers.includes("wildfires") && <WildfireLayer />}
        {activeLayers.includes("places") && <PlacesLayer />}
        {activeLayers.includes("disasters") && <DisastersLayer />}

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

      <GlobeTooltip target={hoverTarget} />

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
