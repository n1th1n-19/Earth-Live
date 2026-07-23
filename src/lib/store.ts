import { create } from "zustand";
import { persist } from "zustand/middleware";

// Ephemeral/local client UI state, deliberately separate from TanStack Query's
// server-state cache — see docs/03-architecture.md §3.3.
// Only layers with a real, wired-up renderer — see docs/04-ui-ux-spec.md §4.4
// (liveness badge is only honest if the layer actually does something).
// Clouds/night-lights/borders/etc. from the full docs/02 layer table are not
// implemented yet — deliberately not exposed as togglable here.
export type LayerId = "weather" | "earthquakes" | "flights" | "iss";

export interface SelectedEvent {
  kind: "earthquake" | "flight" | "iss" | "satellite";
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
  layerPanelOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;

  selectedEvent: SelectedEvent | null;
  setSelectedEvent: (event: SelectedEvent | null) => void;

  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt">) => void;
  removeBookmark: (id: string) => void;

  units: Units;
  setUnits: (units: Units) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  flyToTarget: { latitude: number; longitude: number } | null;
  requestFlyTo: (latitude: number, longitude: number) => void;
  clearFlyTo: () => void;

  // FR-24: cursor coordinate readout, updated imperatively from Globe.tsx.
  cursorCoordinates: { latitude: number; longitude: number } | null;
  setCursorCoordinates: (coords: { latitude: number; longitude: number } | null) => void;
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

      units: "metric",
      setUnits: (units) => set({ units }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      flyToTarget: null,
      requestFlyTo: (latitude, longitude) => set({ flyToTarget: { latitude, longitude } }),
      clearFlyTo: () => set({ flyToTarget: null }),

      cursorCoordinates: null,
      setCursorCoordinates: (coords) => set({ cursorCoordinates: coords }),
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
