import { create } from "zustand";
import { persist } from "zustand/middleware";

// Ephemeral/local client UI state, deliberately separate from TanStack Query's
// server-state cache — see docs/03-architecture.md §3.3.
// Only layers with a real, wired-up renderer — see docs/04-ui-ux-spec.md §4.4
// (liveness badge is only honest if the layer actually does something).
// Clouds/night-lights/borders/etc. from the full docs/02 layer table are not
// implemented yet — deliberately not exposed as togglable here.
export type LayerId = "weather" | "earthquakes" | "flights" | "iss" | "wildfires";

export interface SelectedEvent {
  kind: "earthquake" | "flight" | "iss" | "satellite" | "wildfire";
  title: string;
  attributes: { label: string; value: string }[];
  sourceUrl?: string;
  latitude: number;
  longitude: number;
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

const DEFAULT_LAYERS: LayerId[] = ["weather", "earthquakes", "flights", "iss"];

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeLayers: DEFAULT_LAYERS,
      toggleLayer: (id) => {
        const current = get().activeLayers;
        set({
          activeLayers: current.includes(id)
            ? current.filter((layer) => layer !== id)
            : [...current, id],
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
      }),
    },
  ),
);
