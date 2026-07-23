"use client";

import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useUserLocation } from "@/lib/geolocation";
import { useUiStore } from "@/lib/store";
import { WeatherPanel } from "@/components/panels/WeatherPanel";
import { SunMoonPanel } from "@/components/panels/SunMoonPanel";
import { SpaceWeatherPanel } from "@/components/panels/SpaceWeatherPanel";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EventDetailPanel } from "@/components/panels/EventDetailPanel";
import { CoordinateReadout } from "@/components/panels/CoordinateReadout";
import { BookmarksPanel } from "@/components/panels/BookmarksPanel";
import { ApiStatusPanel } from "@/components/panels/ApiStatusPanel";
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

// Desktop-oriented layout for this slice — the full responsive pass
// (mobile bottom sheets, tablet icon rail, foldable reflow) from
// docs/04-ui-ux-spec.md §4.3/§4.7 is still TODO.
export default function Home() {
  const location = useUserLocation();
  const activeLayers = useUiStore((s) => s.activeLayers);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <div className="relative h-full w-full">
      <Globe
        latitude={location.resolved ? location.latitude : null}
        longitude={location.resolved ? location.longitude : null}
      />

      <CommandPalette />

      {/* Top-left: local conditions (FR-7) */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-3">
        {activeLayers.includes("weather") && (
          <>
            <WeatherPanel location={location} />
            <SunMoonPanel location={location} />
          </>
        )}
      </div>

      {/* Top-right: search, layers, bookmarks, data sources */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-300 backdrop-blur-xl hover:bg-black/60"
        >
          <Search size={14} />
          Search…
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <LayerPanel />
        <BookmarksPanel />
        <ApiStatusPanel />
      </div>

      {/* Bottom-left: coordinates + space weather */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <CoordinateReadout />
        <SpaceWeatherPanel />
      </div>

      {/* Event detail — right side, above the floating globe controls */}
      <div className="pointer-events-none absolute bottom-20 right-4 z-10">
        <EventDetailPanel />
      </div>
    </div>
  );
}
