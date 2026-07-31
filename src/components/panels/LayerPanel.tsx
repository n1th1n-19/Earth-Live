"use client";

import { Layers, X } from "lucide-react";
import { useUiStore, type LayerId } from "@/lib/store";

// docs/04-ui-ux-spec.md §4.4 — categorized, collapsible, liveness badge +
// cadence per row (FR-15). Only layers with a real renderer are listed —
// see the note in src/lib/store.ts.
const LAYERS: { id: LayerId; label: string; category: string; cadence: string }[] = [
  { id: "weather", label: "Weather", category: "Weather", cadence: "~15 min" },
  { id: "earthquakes", label: "Earthquakes", category: "Geological", cadence: "~60 s" },
  { id: "wildfires", label: "Wildfires", category: "Geological", cadence: "~3 hr" },
  { id: "disasters", label: "Disaster alerts", category: "Geological", cadence: "~30 min" },
  { id: "flights", label: "Flights", category: "Transportation", cadence: "~45 s" },
  { id: "iss", label: "ISS", category: "Space", cadence: "~2 s" },
  { id: "places", label: "Capitals", category: "Places", cadence: "static" },
];

const CATEGORIES = ["Weather", "Geological", "Transportation", "Space", "Places"];

export function LayerPanel() {
  const open = useUiStore((s) => s.layerPanelOpen);
  const setOpen = useUiStore((s) => s.setLayerPanelOpen);
  const activeLayers = useUiStore((s) => s.activeLayers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);
  const heatmap = useUiStore((s) => s.earthquakeHeatmap);
  const setHeatmap = useUiStore((s) => s.setEarthquakeHeatmap);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <Layers size={14} />
        Layers
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-64 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs uppercase tracking-wide text-neutral-400">Layers</span>
        <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center text-neutral-500 hover:text-neutral-200">
          <X size={14} />
        </button>
      </div>

      {CATEGORIES.map((category) => {
        const categoryLayers = LAYERS.filter((l) => l.category === category);
        if (categoryLayers.length === 0) return null;
        return (
          <div key={category} className="mb-2">
            <div className="px-1 py-1 text-[10px] uppercase tracking-wide text-neutral-500">{category}</div>
            {categoryLayers.map((layer) => {
              const isOn = activeLayers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isOn ? "bg-emerald-400" : "bg-neutral-600"}`} />
                    {layer.label}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {layer.cadence === "static" ? "Static" : `Live · ${layer.cadence}`}
                  </span>
                </button>
              );
            })}
            {category === "Geological" && activeLayers.includes("earthquakes") && (
              <button
                onClick={() => setHeatmap(!heatmap)}
                className="flex w-full items-center justify-between rounded-lg py-1.5 pl-6 pr-2 hover:bg-white/5"
              >
                <span className="text-xs text-neutral-400">Heatmap view</span>
                <span className={`h-1.5 w-1.5 rounded-full ${heatmap ? "bg-emerald-400" : "bg-neutral-600"}`} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
