"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search, Menu, X } from "lucide-react";
import { useUserLocation } from "@/lib/geolocation";
import { useUiStore } from "@/lib/store";
import { decodeViewState, type ViewState } from "@/lib/view-state";
import { WeatherPanel } from "@/components/panels/WeatherPanel";
import { AirQualityPanel } from "@/components/panels/AirQualityPanel";
import { SunMoonPanel } from "@/components/panels/SunMoonPanel";
import { SpaceWeatherPanel } from "@/components/panels/SpaceWeatherPanel";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EventDetailPanel } from "@/components/panels/EventDetailPanel";
import { CoordinateReadout } from "@/components/panels/CoordinateReadout";
import { BookmarksPanel } from "@/components/panels/BookmarksPanel";
import { ApiStatusPanel } from "@/components/panels/ApiStatusPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { StatsDashboard } from "@/components/panels/StatsDashboard";
import { CreditsPanel } from "@/components/panels/CreditsPanel";
import { ShareButton } from "@/components/panels/ShareButton";
import { ReplayControls } from "@/components/panels/ReplayControls";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

// Cesium touches `window` at module-eval time — must stay client-only,
// never SSR'd. See docs/09-performance-guide.md §9.3 (Cesium is code-split,
// not part of the initial shell bundle).
const Globe = dynamic(() => import("@/components/globe/Globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black text-neutral-500">
      Loading globe…
    </div>
  ),
});

// Partial responsive pass: below `sm`, the desktop-style stack of ~8
// floating utility buttons would overlap/clutter a phone screen, so they
// collapse into one "More" sheet. Local-conditions cards become a
// horizontally-scrollable strip instead of a stacked column. This is not
// the full bottom-sheet system from docs/04-ui-ux-spec.md §4.3 (that's a
// genuinely separate interaction model per breakpoint) — it's a real,
// working reflow, not the complete spec.
export default function Home() {
  const location = useUserLocation();
  const activeLayers = useUiStore((s) => s.activeLayers);
  const setActiveLayers = useUiStore((s) => s.setActiveLayers);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const requestFlyTo = useUiStore((s) => s.requestFlyTo);
  const layerPanelOpen = useUiStore((s) => s.layerPanelOpen);
  const setLayerPanelOpen = useUiStore((s) => s.setLayerPanelOpen);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const replayMode = useUiStore((s) => s.replayMode);
  const setReplayMode = useUiStore((s) => s.setReplayMode);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // FR-26: opening a shared URL reproduces the exact view, no account
  // needed. Decoded once via a lazy initializer (not an effect + setState,
  // which React flags as cascading-render-prone) — suppresses Globe's own
  // geolocation-driven fly-to below so the shared view isn't overridden.
  const [sharedView] = useState<ViewState | null>(() =>
    typeof window === "undefined" ? null : decodeViewState(new URLSearchParams(window.location.search)),
  );

  // requestFlyTo/setActiveLayers sync an external store, not React state —
  // fine to call from an effect, unlike setSharedView above would have been.
  useEffect(() => {
    if (!sharedView) return;
    requestFlyTo(sharedView.latitude, sharedView.longitude, sharedView.height);
    if (sharedView.layers.length > 0) setActiveLayers(sharedView.layers);
  }, [sharedView, requestFlyTo, setActiveLayers]);

  // docs/04-ui-ux-spec.md §4.6 keyboard shortcuts. Cmd/Ctrl+K and `/` are
  // handled inside CommandPalette itself. B (bookmarks) is not wired —
  // its open state isn't lifted to the store, unlike layerPanelOpen.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key.toLowerCase() === "l") {
        setLayerPanelOpen(!layerPanelOpen);
      } else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else if (e.key.toLowerCase() === "r") {
        setReplayMode(!replayMode);
      } else if (e.key === "Escape") {
        setSelectedEvent(null);
        setLayerPanelOpen(false);
        setMobileMenuOpen(false);
        if (replayMode) setReplayMode(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layerPanelOpen, setLayerPanelOpen, setSelectedEvent, replayMode, setReplayMode]);

  const utilityButtons = (
    <>
      <LayerPanel />
      <BookmarksPanel />
      <StatsDashboard />
      <ApiStatusPanel />
      <SettingsPanel />
      <CreditsPanel />
      <ShareButton />
    </>
  );

  return (
    <div className="relative h-full w-full">
      <Globe
        latitude={sharedView ? null : location.resolved ? location.latitude : null}
        longitude={sharedView ? null : location.resolved ? location.longitude : null}
      />

      <CommandPalette />

      {/* Top-center: replay mode toggle/scrubber (FR-29) */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-10 w-[min(92vw,36rem)] -translate-x-1/2 sm:top-4">
        <ReplayControls />
      </div>

      {/* Top-left: local conditions (FR-7). Horizontal scroll strip on
          mobile instead of a tall stacked column. */}
      <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex gap-3 overflow-x-auto sm:left-4 sm:right-auto sm:top-4 sm:flex-col sm:overflow-visible">
        {activeLayers.includes("weather") && (
          <>
            <WeatherPanel location={location} />
            <AirQualityPanel location={location} />
            <SunMoonPanel location={location} />
          </>
        )}
      </div>

      {/* Top-right: search always visible; utility buttons collapse to one
          "More" menu below `sm`. */}
      <div className="pointer-events-none absolute right-4 top-20 z-10 flex flex-col items-end gap-3 sm:top-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-300 backdrop-blur-xl hover:bg-black/60"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
        </button>

        <div className="hidden flex-col items-end gap-3 sm:flex">{utilityButtons}</div>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-300 backdrop-blur-xl hover:bg-black/60 sm:hidden"
          aria-label="More"
        >
          <Menu size={14} />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-white/10 bg-black/80 p-4 backdrop-blur-2xl sm:hidden">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Menu</span>
            <button onClick={() => setMobileMenuOpen(false)} className="text-neutral-500 hover:text-neutral-200">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">{utilityButtons}</div>
        </div>
      )}

      {/* Bottom-left: coordinates + space weather */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden items-center gap-2 sm:flex">
        <CoordinateReadout />
        <SpaceWeatherPanel />
      </div>

      {/* Event detail — right side on desktop, full-width sheet on mobile */}
      <div className="pointer-events-none absolute inset-x-4 bottom-20 z-10 flex justify-end sm:inset-x-auto sm:right-4">
        <EventDetailPanel />
      </div>
    </div>
  );
}
