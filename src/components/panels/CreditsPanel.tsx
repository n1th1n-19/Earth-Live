"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

// Phase 8 launch item: one consolidated attribution surface for every
// source whose terms require credit (docs/05-api-integration-guide.md
// per-source "Attribution" field) — individual panels also credit their
// own source inline, this is the single place that lists all of them.
const SOURCES: { name: string; note: string }[] = [
  { name: "Open-Meteo.com", note: "Weather (CC BY 4.0)" },
  { name: "USGS Earthquake Hazards Program", note: "Earthquakes (public domain)" },
  { name: "NASA FIRMS", note: "Active fire detections" },
  { name: "CelesTrak", note: "Satellite/ISS orbital elements" },
  { name: "OpenSky Network", note: "Live flight positions" },
  { name: "NOAA Space Weather Prediction Center", note: "Kp index" },
  { name: "NASA DONKI", note: "Space weather notifications" },
  { name: "sunrise-sunset.org", note: "Sunrise/sunset times" },
  { name: "OpenAQ", note: "Air quality station data (CC BY 4.0)" },
  { name: "GeoNames", note: "Timezone lookup (CC BY 4.0)" },
  { name: "OpenStreetMap contributors", note: "Base map imagery (ODbL)" },
  { name: "NASA GIBS / VIIRS", note: "Cloud overlay (true color, ~1 day lag)" },
  { name: "NASA Black Marble", note: "Night-lights overlay (VIIRS City Lights 2012)" },
  { name: "Cesium ion", note: "World Terrain + satellite base imagery" },
];

export function CreditsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
        aria-label="Data credits"
      >
        <Info size={14} />
      </button>

      {open && (
        <div className="mt-2 w-72 rounded-2xl border border-white/10 bg-black/50 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Data credits</span>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center text-neutral-500 hover:text-neutral-200">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto text-xs">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex justify-between gap-2 border-b border-white/5 pb-1.5 last:border-0">
                <span className="text-neutral-200">{s.name}</span>
                <span className="text-right text-neutral-500">{s.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
