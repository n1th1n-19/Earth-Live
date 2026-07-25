import type { LayerId } from "@/lib/store";

// FR-25/26: encode/decode the full view state into a shareable URL — camera
// position + active layers — so opening a shared link reproduces the view
// without an account (FR-26).
export interface ViewState {
  latitude: number;
  longitude: number;
  height: number;
  layers: LayerId[];
}

const ALL_LAYER_IDS: LayerId[] = ["weather", "earthquakes", "flights", "iss", "wildfires"];

export function encodeViewState(state: ViewState): string {
  const params = new URLSearchParams({
    lat: state.latitude.toFixed(5),
    lon: state.longitude.toFixed(5),
    h: Math.round(state.height).toString(),
    layers: state.layers.join(","),
  });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export function decodeViewState(searchParams: URLSearchParams): ViewState | null {
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const lon = Number.parseFloat(searchParams.get("lon") ?? "");
  const height = Number.parseFloat(searchParams.get("h") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(height)) return null;

  const layersParam = searchParams.get("layers");
  const layers = layersParam
    ? (layersParam.split(",").filter((l): l is LayerId => ALL_LAYER_IDS.includes(l as LayerId)))
    : [];

  return { latitude: lat, longitude: lon, height, layers };
}
