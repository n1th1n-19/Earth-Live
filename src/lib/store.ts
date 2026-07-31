import { create } from "zustand";
import { persist } from "zustand/middleware";

// Ephemeral/local client UI state, deliberately separate from TanStack Query's
// server-state cache — see docs/03-architecture.md §3.3.
// Only layers with a real, wired-up renderer — see docs/04-ui-ux-spec.md §4.4
// (liveness badge is only honest if the layer actually does something).
// Clouds/night-lights/borders/etc. from the full docs/02 layer table are not
// implemented yet — deliberately not exposed as togglable here.
export type LayerId = "weather" | "earthquakes" | "flights" | "iss" | "wildfires" | "places" | "disasters" | "alerts" | "volcanoes" | "airports";

/** The individually closeable local-conditions cards (top-left of the globe). */
export type PanelId = "weather" | "airQuality" | "sunMoon";

export interface SelectedEvent {
  kind: "earthquake" | "flight" | "iss" | "satellite" | "wildfire" | "place" | "disaster" | "alert" | "volcano" | "airport";
  title: string;
  attributes: { label: string; value: string }[];
  sourceUrl?: string;
  latitude: number;
  longitude: number;
  /**
   * Real ICAO callsign, flights only. Kept separate from `title` because
   * that falls back to the icao24 hex id when a flight is broadcasting no
   * callsign — feeding that fallback to adsbdb would be a guaranteed miss.
   */
  callsign?: string;
  /** Capital-city places only — used to look up the place's own detail. */
  placeName?: string;
  country?: string;
}

export interface Bookmark {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export type Units = "metric" | "imperial";

interface UiState {
  activeLayers: LayerId[];
  toggleLayer: (id: LayerId) => void;
  setActiveLayers: (layers: LayerId[]) => void;
  layerPanelOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;

  selectedEvent: SelectedEvent | null;
  setSelectedEvent: (event: SelectedEvent | null) => void;

  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  removeBookmark: (id: string) => void;
  bookmarksPanelOpen: boolean;
  setBookmarksPanelOpen: (open: boolean) => void;

  units: Units;
  setUnits: (units: Units) => void;

  // Earthquake layer render mode: individual clustered points vs a density
  // heatmap of the same live/replay data — a view toggle, not a data layer.
  earthquakeHeatmap: boolean;
  setEarthquakeHeatmap: (on: boolean) => void;

  // Drifts the camera westward at the Earth's true sidereal rate (~15°/hr)
  // so the globe tracks real rotation. A display preference, so persisted.
  earthRotation: boolean;
  setEarthRotation: (on: boolean) => void;

  // Local-conditions cards the user has closed individually. Persisted, so a
  // dismissed card stays gone across reloads. Recovery is deliberately the
  // Weather layer toggle (see toggleLayer) rather than a separate control —
  // it already governs these three cards.
  dismissedPanels: PanelId[];
  dismissPanel: (id: PanelId) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  flyToTarget: { latitude: number; longitude: number; height?: number } | null;
  requestFlyTo: (latitude: number, longitude: number, height?: number) => void;
  clearFlyTo: () => void;

  // FR-24: cursor coordinate readout, updated imperatively from Globe.tsx.
  cursorCoordinates: { latitude: number; longitude: number } | null;
  setCursorCoordinates: (coords: { latitude: number; longitude: number } | null) => void;

  // FR-25/26: current camera pose, sampled on Cesium's `moveEnd` — this is
  // what a shared URL actually needs to reproduce the view (fly-to targets
  // above are one-shot commands, not a persistent "where is the camera now").
  cameraPosition: { latitude: number; longitude: number; height: number } | null;
  setCameraPosition: (pos: { latitude: number; longitude: number; height: number }) => void;

  // FR-29: replay mode. `replayCursor` is the scrubbed instant within
  // [replayWindowStart, replayWindowEnd]; EarthquakeLayer switches from the
  // live feed to a `/api/earthquakes/history` query filtered up to the
  // cursor while this is active.
  replayMode: boolean;
  replayWindowStart: string;
  replayWindowEnd: string;
  replayCursor: string;
  setReplayMode: (on: boolean) => void;
  setReplayCursor: (iso: string) => void;
}

const DEFAULT_LAYERS: LayerId[] = ["weather", "earthquakes", "flights", "iss", "places"];

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeLayers: DEFAULT_LAYERS,
      toggleLayer: (id) => {
        const current = get().activeLayers;
        const enabling = !current.includes(id);
        set({
          activeLayers: enabling ? [...current, id] : current.filter((layer) => layer !== id),
          // Switching Weather back on is the recovery path for individually
          // closed local-conditions cards — otherwise closing all three
          // would leave no way to get them back.
          ...(id === "weather" && enabling ? { dismissedPanels: [] } : {}),
        });
      },
      setActiveLayers: (layers) => set({ activeLayers: layers }),
      layerPanelOpen: false,
      setLayerPanelOpen: (open) => set({ layerPanelOpen: open }),

      selectedEvent: null,
      setSelectedEvent: (event) => set({ selectedEvent: event }),

      // Anonymous bookmarks (FR-19/FR-21): local storage now, syncable to the
      // `bookmarks` table (docs/06-database-design.md) once auth ships.
      bookmarks: [],
      addBookmark: (bookmark) => {
        const id = crypto.randomUUID();
        set({
          bookmarks: [
            ...get().bookmarks,
            { ...bookmark, id, createdAt: new Date().toISOString() },
          ],
        });
      },
      removeBookmark: (id) => set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) }),
      bookmarksPanelOpen: false,
      setBookmarksPanelOpen: (open) => set({ bookmarksPanelOpen: open }),

      units: "metric",
      setUnits: (units) => set({ units }),

      earthquakeHeatmap: false,
      setEarthquakeHeatmap: (on) => set({ earthquakeHeatmap: on }),

      earthRotation: true,
      setEarthRotation: (on) => set({ earthRotation: on }),

      dismissedPanels: [],
      dismissPanel: (id) => {
        const current = get().dismissedPanels;
        if (current.includes(id)) return;
        set({ dismissedPanels: [...current, id] });
      },

      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      flyToTarget: null,
      requestFlyTo: (latitude, longitude, height) => set({ flyToTarget: { latitude, longitude, height } }),
      clearFlyTo: () => set({ flyToTarget: null }),

      cursorCoordinates: null,
      setCursorCoordinates: (coords) => set({ cursorCoordinates: coords }),

      cameraPosition: null,
      setCameraPosition: (pos) => set({ cameraPosition: pos }),

      replayMode: false,
      replayWindowStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      replayWindowEnd: new Date().toISOString(),
      replayCursor: new Date().toISOString(),
      setReplayMode: (on) =>
        set({
          replayMode: on,
          replayWindowStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          replayWindowEnd: new Date().toISOString(),
          replayCursor: new Date().toISOString(),
        }),
      setReplayCursor: (iso) => set({ replayCursor: iso }),
    }),
    {
      name: "earth-live-ui",
      // Only persist genuinely durable local state — selection/palette/fly-to
      // are per-session, not preferences.
      partialize: (state) => ({
        activeLayers: state.activeLayers,
        bookmarks: state.bookmarks,
        units: state.units,
        earthRotation: state.earthRotation,
        dismissedPanels: state.dismissedPanels,
      }),
    },
  ),
);
