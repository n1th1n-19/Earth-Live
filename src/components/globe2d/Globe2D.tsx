"use client";

import { useEffect, useRef, useState } from "react";
import { geoDistance, geoOrthographic, geoPath, interpolate as d3Interpolate, easeCubicInOut } from "d3";
import { useUiStore } from "@/lib/store";
import { totalPathDistanceKm, type LatLon } from "@/lib/geo-math";
import { formatDistanceKm } from "@/lib/units";
import { FloatingControls } from "@/components/globe2d/FloatingControls";
import { GlobeTooltip, type HoverTarget } from "@/components/globe2d/GlobeTooltip";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

import * as land from "@/lib/globe2d/layers/land";
import * as borders from "@/lib/globe2d/layers/borders";
import * as auroraLayer from "@/lib/globe2d/layers/aurora";
import * as userLocationLayer from "@/lib/globe2d/layers/user-location";
import * as terminator from "@/lib/globe2d/layers/terminator";
import * as places from "@/lib/globe2d/layers/places";
import * as volcanoes from "@/lib/globe2d/layers/volcanoes";
import * as airports from "@/lib/globe2d/layers/airports";
import * as earthquakes from "@/lib/globe2d/layers/earthquakes";
import * as disasters from "@/lib/globe2d/layers/disasters";
import * as wildfires from "@/lib/globe2d/layers/wildfires";
import * as weatherAlerts from "@/lib/globe2d/layers/weather-alerts";
import * as issLayer from "@/lib/globe2d/layers/iss";
import * as flightsLayer from "@/lib/globe2d/layers/flights";

// Whole-globe framing, same real-world constant Cesium used — only consumer
// is the height<->scale heuristic below, a monotonic zoom proxy rather than
// a physically accurate reprojection (orthographic has no camera height).
const GLOBAL_VIEW_HEIGHT_M = 20_000_000;
const MIN_HIT_RADIUS = 6;
const CLICK_DRAG_THRESHOLD_PX = 4;

interface Globe2DProps {
  latitude: number | null;
  longitude: number | null;
}

interface FrameState {
  activeLayers: string[];
  earthquakeHeatmap: boolean;
  measuring: boolean;
  measurePoints: LatLon[];
  land: ReturnType<typeof land.useLandData>;
  borders: ReturnType<typeof borders.useBordersData>;
  aurora: ReturnType<typeof auroraLayer.useAuroraData>["data"];
  userLocation: { latitude: number; longitude: number } | null;
  places: ReturnType<typeof places.usePlacesData>;
  volcanoes: ReturnType<typeof volcanoes.useVolcanoesData>;
  nearbyAirports: ReturnType<typeof airports.useNearbyAirports>;
  earthquakes: ReturnType<typeof earthquakes.useEarthquakeData>;
  disasters: ReturnType<typeof disasters.useDisastersData>;
  wildfires: ReturnType<typeof wildfires.useWildfiresData>;
  weatherAlerts: ReturnType<typeof weatherAlerts.useWeatherAlertsData>;
  iss: ReturnType<typeof issLayer.useIssData>;
  flights: flightsLayer.FlightsState;
  flightRoute: ReturnType<typeof flightsLayer.useSelectedFlightRoute>;
  visibleFlightRoutes: ReturnType<typeof flightsLayer.useVisibleFlightRoutes>;
}

export function Globe2D({ latitude, longitude }: Globe2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFlownRef = useRef(false);

  const activeLayers = useUiStore((s) => s.activeLayers);
  const units = useUiStore((s) => s.units);
  const setCameraPosition = useUiStore((s) => s.setCameraPosition);
  const setCursorCoordinates = useUiStore((s) => s.setCursorCoordinates);
  const flyToTarget = useUiStore((s) => s.flyToTarget);
  const clearFlyTo = useUiStore((s) => s.clearFlyTo);
  const earthRotation = useUiStore((s) => s.earthRotation);
  const earthquakeHeatmap = useUiStore((s) => s.earthquakeHeatmap);
  const replayMode = useUiStore((s) => s.replayMode);
  const replayWindowStart = useUiStore((s) => s.replayWindowStart);
  const replayCursor = useUiStore((s) => s.replayCursor);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const cameraPosition = useUiStore((s) => s.cameraPosition);

  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLon[]>([]);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

  const landData = land.useLandData();
  const bordersData = borders.useBordersData();
  const { data: auroraData } = auroraLayer.useAuroraData();
  const placesData = places.usePlacesData();
  const volcanoesData = volcanoes.useVolcanoesData();
  const airportsData = airports.useAirportsData();
  const nearbyAirports = airports.useNearbyAirports(airportsData, cameraPosition);
  const earthquakeData = earthquakes.useEarthquakeData(replayMode, replayWindowStart, replayCursor);
  const disastersData = disasters.useDisastersData();
  const wildfiresData = wildfires.useWildfiresData();
  const weatherAlertsData = weatherAlerts.useWeatherAlertsData();
  const issData = issLayer.useIssData();
  const flightsState = flightsLayer.useFlightsData();
  const flightRoute = flightsLayer.useSelectedFlightRoute();
  const visibleFlightRoutes = flightsLayer.useVisibleFlightRoutes(flightsState.flights);

  const stateRef = useRef<FrameState>({
    activeLayers,
    earthquakeHeatmap,
    measuring,
    measurePoints,
    land: null,
    borders: null,
    aurora: undefined,
    userLocation: null,
    places: null,
    volcanoes: null,
    nearbyAirports: [],
    earthquakes: undefined,
    disasters: undefined,
    wildfires: undefined,
    weatherAlerts: undefined,
    iss: null,
    flights: { flights: undefined, trails: new Map() },
    flightRoute: undefined,
    visibleFlightRoutes: new Map(),
  });
  const renderRef = useRef<() => void>(() => {});
  const animateToRef = useRef<(lng: number, lat: number, scale: number, durationMs?: number) => void>(() => {});
  const setRotationInstantRef = useRef<(lng: number, lat: number) => void>(() => {});
  const zoomByRef = useRef<(factor: number) => void>(() => {});
  const earthRotationRef = useRef(earthRotation);

  // Shared by recenter()/flyToTarget below — the same "fit radius" formula
  // the main effect uses, with a same-shaped fallback (not a bare `1`) for
  // the brief window before the container ref is attached.
  function getBaseRadius(): number {
    const el = containerRef.current;
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    return Math.min(w, h) / 2.5;
  }

  // Refs can't be written during render (see react-hooks/refs), so syncing
  // the latest React state into them — for the imperative render loop below
  // to read — happens in effects instead. Both run after every
  // render/commit, in declaration order, so stateRef is always current by
  // the time the render-trigger effect fires.
  useEffect(() => {
    earthRotationRef.current = earthRotation;
    stateRef.current = {
      activeLayers,
      earthquakeHeatmap,
      measuring,
      measurePoints,
      land: landData,
      borders: bordersData,
      aurora: auroraData,
      userLocation: latitude == null || longitude == null ? null : { latitude, longitude },
      places: placesData,
      volcanoes: volcanoesData,
      nearbyAirports,
      earthquakes: earthquakeData,
      disasters: disastersData,
      wildfires: wildfiresData,
      weatherAlerts: weatherAlertsData,
      iss: issData,
      flights: flightsState,
      flightRoute,
      visibleFlightRoutes,
    };
  });

  // Redraw whenever React state changes (query data landing, store toggles,
  // measuring points) — the imperative render loop otherwise only redraws on
  // its own rotation timer / pointer events. Declared after the sync effect
  // above so it always sees this render's fresh stateRef.
  useEffect(() => {
    renderRef.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let containerWidth = container.clientWidth || window.innerWidth;
    let containerHeight = container.clientHeight || window.innerHeight;
    let baseRadius = Math.min(containerWidth, containerHeight) / 2.5;
    let MIN_SCALE = baseRadius * 0.5;
    let MAX_SCALE = baseRadius * 4;

    const projection = geoOrthographic()
      .scale(baseRadius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90);
    const path = geoPath().projection(projection).context(context);

    function isFrontFacing(lng: number, lat: number): boolean {
      const center = projection.invert?.([containerWidth / 2, containerHeight / 2]);
      if (!center) return true;
      return geoDistance([lng, lat], center) < Math.PI / 2;
    }

    function clampScale(scale: number): number {
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    }

    function currentDrawArgs(): DrawArgs {
      return {
        ctx: context!,
        projection,
        path,
        scaleFactor: projection.scale() / baseRadius,
        width: containerWidth,
        height: containerHeight,
        isFrontFacing,
      };
    }

    function collectHitCandidates(): HitCandidate[] {
      const args = currentDrawArgs();
      const state = stateRef.current;
      const all: HitCandidate[] = [...userLocationLayer.getHitCandidates(args, state.userLocation)];
      if (state.activeLayers.includes("places")) all.push(...places.getHitCandidates(args, state.places));
      if (state.activeLayers.includes("volcanoes")) all.push(...volcanoes.getHitCandidates(args, state.volcanoes));
      if (state.activeLayers.includes("airports")) all.push(...airports.getHitCandidates(args, state.nearbyAirports));
      if (state.activeLayers.includes("disasters")) all.push(...disasters.getHitCandidates(args, state.disasters));
      if (state.activeLayers.includes("earthquakes")) {
        all.push(...earthquakes.getHitCandidates(args, state.earthquakes, state.earthquakeHeatmap));
      }
      if (state.activeLayers.includes("wildfires")) all.push(...wildfires.getHitCandidates(args, state.wildfires));
      if (state.activeLayers.includes("iss")) all.push(...issLayer.getHitCandidates(args, state.iss));
      if (state.activeLayers.includes("flights")) all.push(...flightsLayer.getHitCandidates(args, state.flights));
      return all;
    }

    function pickNearest(screenX: number, screenY: number): HitCandidate | null {
      let best: HitCandidate | null = null;
      let bestDist = Infinity;
      for (const candidate of collectHitCandidates()) {
        const dist = Math.hypot(candidate.screenX - screenX, candidate.screenY - screenY);
        const radius = Math.max(candidate.screenRadius, MIN_HIT_RADIUS);
        if (dist <= radius && dist < bestDist) {
          best = candidate;
          bestDist = dist;
        }
      }
      if (best) return best;

      const state = stateRef.current;
      if (state.activeLayers.includes("alerts")) {
        return weatherAlerts.hitTestPoint(currentDrawArgs(), state.weatherAlerts, screenX, screenY);
      }
      return null;
    }

    function render() {
      const state = stateRef.current;
      context!.clearRect(0, 0, containerWidth, containerHeight);

      const currentScale = projection.scale();
      const scaleFactor = currentScale / baseRadius;

      context!.beginPath();
      context!.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI);
      context!.fillStyle = "#000000";
      context!.fill();
      context!.strokeStyle = "#ffffff";
      context!.lineWidth = 2 * scaleFactor;
      context!.stroke();

      const args = currentDrawArgs();

      if (state.land) land.draw(args, state.land);
      if (state.borders) borders.draw(args, state.borders);
      userLocationLayer.draw(args, state.userLocation);
      auroraLayer.draw(args, state.aurora);

      if (state.activeLayers.includes("places")) places.draw(args, state.places);
      if (state.activeLayers.includes("volcanoes")) volcanoes.draw(args, state.volcanoes);
      if (state.activeLayers.includes("airports")) airports.draw(args, state.nearbyAirports);
      if (state.activeLayers.includes("disasters")) disasters.draw(args, state.disasters);
      if (state.activeLayers.includes("alerts")) weatherAlerts.draw(args, state.weatherAlerts);
      if (state.activeLayers.includes("earthquakes")) {
        earthquakes.draw(args, state.earthquakes, state.earthquakeHeatmap);
      }
      if (state.activeLayers.includes("wildfires")) wildfires.draw(args, state.wildfires);
      if (state.activeLayers.includes("iss")) issLayer.draw(args, state.iss);
      if (state.activeLayers.includes("flights")) {
        flightsLayer.draw(args, state.flights, state.visibleFlightRoutes, state.flightRoute ?? undefined);
      }

      // Drawn last so it dims everything on the night side uniformly
      // (land, borders, markers) — a black fill layered under bright content
      // instead of over it would be invisible against the already-black ocean.
      terminator.draw(args, new Date());

      if (state.measurePoints.length > 0) {
        for (const point of state.measurePoints) {
          const p = projection([point.longitude, point.latitude]);
          if (!p) continue;
          context!.beginPath();
          context!.arc(p[0], p[1], 4 * scaleFactor, 0, Math.PI * 2);
          context!.fillStyle = "#32ff7e";
          context!.fill();
        }
        if (state.measurePoints.length >= 2) {
          context!.beginPath();
          path({
            type: "LineString",
            coordinates: state.measurePoints.map((p) => [p.longitude, p.latitude]),
          });
          context!.strokeStyle = "#32ff7e";
          context!.lineWidth = 2 * scaleFactor;
          context!.stroke();
        }
      }
    }
    renderRef.current = render;

    function animateTo(targetLng: number, targetLat: number, targetScale: number, durationMs = 1500) {
      const startRotation = projection.rotate();
      const startScale = projection.scale();
      const rotationInterp = d3Interpolate(startRotation, [-targetLng, -targetLat, startRotation[2] ?? 0]);
      const scaleInterp = d3Interpolate(startScale, clampScale(targetScale));
      const start = performance.now();
      function step(now: number) {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = easeCubicInOut(t);
        projection.rotate(rotationInterp(eased) as [number, number, number]);
        projection.scale(scaleInterp(eased));
        render();
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    animateToRef.current = animateTo;
    setRotationInstantRef.current = (lng, lat) => {
      projection.rotate([-lng, -lat]);
      render();
    };

    // Camera pose sampling — throttled (unlike the render loop, which runs
    // every animation frame during auto-rotation) since AirportsLayer
    // recomputes a haversine sort over every airport whenever this changes.
    // Also skipped entirely when the pose hasn't moved meaningfully (e.g.
    // rotation paused, already fully zoomed) so that recompute doesn't fire
    // every 500ms regardless of whether the view actually changed.
    let lastCameraPose: { latitude: number; longitude: number; height: number } | null = null;
    const cameraSampleInterval = setInterval(() => {
      const center = projection.invert?.([containerWidth / 2, containerHeight / 2]);
      if (!center) return;
      const pose = {
        latitude: center[1],
        longitude: center[0],
        height: GLOBAL_VIEW_HEIGHT_M * (baseRadius / projection.scale()),
      };
      if (
        lastCameraPose &&
        Math.abs(pose.latitude - lastCameraPose.latitude) < 0.05 &&
        Math.abs(pose.longitude - lastCameraPose.longitude) < 0.05 &&
        Math.abs(pose.height - lastCameraPose.height) / lastCameraPose.height < 0.02
      ) {
        return;
      }
      lastCameraPose = pose;
      setCameraPosition(pose);
    }, 500);

    let autoRotateLocal = true;
    const rotationSpeedDeg = 0.02;
    let lastTick = performance.now();
    function tick(now: number) {
      const elapsed = now - lastTick;
      lastTick = now;
      if (autoRotateLocal && earthRotationRef.current) {
        const rotation = projection.rotate();
        projection.rotate([rotation[0] + rotationSpeedDeg * (elapsed / 16.7), rotation[1], rotation[2]]);
        render();
      }
      animationFrame = requestAnimationFrame(tick);
    }
    let animationFrame = requestAnimationFrame(tick);

    let dragDistance = 0;
    // Tracked so the component-unmount cleanup can remove them if it fires
    // mid-drag — otherwise a drag interrupted by unmount (e.g. navigating
    // away) left these document listeners attached forever, referencing this
    // closure's now-stale projection/render.
    let activePointerMove: ((event: PointerEvent) => void) | null = null;
    let activePointerUp: (() => void) | null = null;

    function handlePointerDown(event: PointerEvent) {
      autoRotateLocal = false;
      dragDistance = 0;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRotation = projection.rotate();

      function onMove(moveEvent: PointerEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        dragDistance = Math.max(dragDistance, Math.hypot(dx, dy));
        const sensitivity = 0.5;
        projection.rotate([
          startRotation[0] + dx * sensitivity,
          Math.max(-90, Math.min(90, startRotation[1] - dy * sensitivity)),
          startRotation[2] ?? 0,
        ]);
        render();
      }
      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        activePointerMove = null;
        activePointerUp = null;
        setTimeout(() => {
          autoRotateLocal = true;
        }, 10);
      }
      activePointerMove = onMove;
      activePointerUp = onUp;
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }

    function zoomBy(factor: number) {
      projection.scale(clampScale(projection.scale() * factor));
      render();
    }
    zoomByRef.current = zoomBy;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
    }

    let pendingHover: { x: number; y: number } | null = null;
    let hoverFrame: number | null = null;
    function handleMouseMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      const coords = projection.invert?.([screenX, screenY]);
      setCursorCoordinates(coords && isFrontFacing(coords[0], coords[1]) ? { latitude: coords[1], longitude: coords[0] } : null);

      pendingHover = { x: screenX, y: screenY };
      if (hoverFrame !== null) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        if (!pendingHover) return;
        const candidate = pickNearest(pendingHover.x, pendingHover.y);
        setHoverTarget(
          candidate ? { label: candidate.label, detail: candidate.detail, x: pendingHover.x, y: pendingHover.y } : null,
        );
      });
    }

    function handleClick(event: MouseEvent) {
      if (dragDistance > CLICK_DRAG_THRESHOLD_PX) return;
      const rect = canvas!.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      if (stateRef.current.measuring) {
        const coords = projection.invert?.([screenX, screenY]);
        if (coords) setMeasurePoints((prev) => [...prev, { latitude: coords[1], longitude: coords[0] }]);
        return;
      }

      const candidate = pickNearest(screenX, screenY);
      if (!candidate) return;
      if (candidate.toSelectedEvent) {
        setSelectedEvent(candidate.toSelectedEvent());
      } else if (candidate.flyTo) {
        animateTo(candidate.flyTo.longitude, candidate.flyTo.latitude, Math.min(MAX_SCALE, projection.scale() * 3));
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      containerWidth = container.clientWidth;
      containerHeight = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      projection.translate([containerWidth / 2, containerHeight / 2]);

      // Rescale to the new container so the globe keeps the same *zoom
      // level* (scaleFactor) instead of snapping back to a default fit sized
      // for the old dimensions — otherwise a window resize or mobile
      // orientation change left MIN_SCALE/MAX_SCALE (and the current zoom)
      // tied to stale dimensions.
      const scaleFactor = projection.scale() / baseRadius;
      baseRadius = Math.min(containerWidth, containerHeight) / 2.5;
      MIN_SCALE = baseRadius * 0.5;
      MAX_SCALE = baseRadius * 4;
      projection.scale(clampScale(scaleFactor * baseRadius));

      render();
    });
    resizeObserver.observe(container);
    // Trigger the initial sizing pass (ResizeObserver's own first callback
    // already covers this, but firing it synchronously avoids a one-frame
    // flash at the wrong canvas size on mount).
    {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // docs/04-ui-ux-spec.md §4.6: "+ / - | Zoom in/out", plus WASD fly
    // controls — rotates the sphere instead of translating a 3D camera
    // (there's no camera-height concept in orthographic projection), with
    // step size scaled inversely to zoom so panning feels consistent at any
    // scale, mirroring Cesium's height-scaled moveRate.
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "+" || e.key === "=") {
        projection.scale(clampScale(projection.scale() * 1.1));
        render();
        return;
      }
      if (e.key === "-" || e.key === "_") {
        projection.scale(clampScale(projection.scale() / 1.1));
        render();
        return;
      }

      const step = (2 * baseRadius) / projection.scale();
      const rotation = projection.rotate();
      switch (e.key.toLowerCase()) {
        case "w":
          rotation[1] = Math.max(-90, Math.min(90, rotation[1] - step));
          break;
        case "s":
          rotation[1] = Math.max(-90, Math.min(90, rotation[1] + step));
          break;
        case "a":
          rotation[0] += step;
          break;
        case "d":
          rotation[0] -= step;
          break;
        default:
          return;
      }
      projection.rotate(rotation);
      render();
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("keydown", onKeyDown);

    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(cameraSampleInterval);
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", onKeyDown);
      if (activePointerMove) document.removeEventListener("pointermove", activePointerMove);
      if (activePointerUp) document.removeEventListener("pointerup", activePointerUp);
    };
    // Runs once — store actions (setCameraPosition, etc.) are stable zustand
    // references, and all other reactive values flow in via stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial geolocation fly-to — recenters once, doesn't zoom (matches the
  // Cesium version: granting location permission no longer yanks the camera
  // in, UserLocationMarker/this pin is enough).
  useEffect(() => {
    if (latitude == null || longitude == null || hasFlownRef.current) return;
    hasFlownRef.current = true;
    setRotationInstantRef.current(longitude, latitude);
  }, [latitude, longitude]);

  // Command palette / shared-URL fly-to.
  useEffect(() => {
    if (!flyToTarget) return;
    const targetScale = (GLOBAL_VIEW_HEIGHT_M / (flyToTarget.height ?? 1_000_000)) * getBaseRadius();
    animateToRef.current(flyToTarget.longitude, flyToTarget.latitude, targetScale);
    clearFlyTo();
  }, [flyToTarget, clearFlyTo]);

  function recenter() {
    if (latitude == null || longitude == null) return;
    animateToRef.current(longitude, latitude, getBaseRadius() * 2.5);
  }

  function zoomIn() {
    zoomByRef.current(1.1);
  }
  function zoomOut() {
    zoomByRef.current(0.9);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }

  function screenshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `earth-live-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function toggleMeasuring() {
    const next = !measuring;
    setMeasuring(next);
    if (!next) setMeasurePoints([]);
  }

  const measureDistanceKm = totalPathDistanceKm(measurePoints);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" style={{ touchAction: "none" }} />

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
