"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

// Phase 8 launch item: one consolidated attribution surface for every
// source whose terms require credit (docs/05-api-integration-guide.md
// per-source "Attribution" field) — individual panels also credit their
// own source inline, this is the single place that lists all of them.
// CC BY requires the licensee to name the author, the work, the licence, and
// link back — so those rows carry `url`/`license` rather than a bare note.
const SOURCES: { name: string; note: string; url?: string; license?: string }[] = [
  { name: "Open-Meteo.com", note: "Weather (CC BY 4.0)" },
  { name: "USGS Earthquake Hazards Program", note: "Earthquakes (public domain)" },
  { name: "NASA FIRMS", note: "Active fire detections" },
  { name: "CelesTrak", note: "Satellite/ISS orbital elements" },
  { name: "OpenSky Network", note: "Live flight positions" },
  { name: "adsbdb.com", note: "Flight routes (selected flight only)" },
  { name: "NOAA Space Weather Prediction Center", note: "Kp index" },
  { name: "GDACS (European Commission & UN)", note: "Global disaster alerts" },
  { name: "NOAA / National Weather Service", note: "US severe weather alerts (public domain)" },
  { name: "Smithsonian Global Volcanism Program", note: "Volcano locations" },
  { name: "OurAirports", note: "Airport locations (public domain)" },
  { name: "NASA DONKI", note: "Space weather notifications" },
  { name: "sunrise-sunset.org", note: "Sunrise/sunset times" },
  { name: "OpenAQ", note: "Air quality station data (CC BY 4.0)" },
  { name: "GeoNames", note: "Timezone lookup (CC BY 4.0)" },
  { name: "Natural Earth", note: "Country borders + capital cities (public domain, 1:110m)" },
  {
    name: "Font Awesome 6",
    note: "Globe marker icons (plane, satellite, volcano, flame, etc.), via react-icons",
    url: "https://fontawesome.com/",
    license: "CC BY 4.0",
  },
  {
    name: "Game Icons (game-icons.net)",
    note: "Earthquake marker icon, via react-icons",
    url: "https://game-icons.net/",
    license: "CC BY 3.0",
  },
  {
    name: "Wikipedia",
    note: "Place summaries",
    url: "https://en.wikipedia.org",
    license: "CC BY-SA 4.0",
  },
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
              <div key={s.name} className="border-b border-white/5 pb-1.5 last:border-0">
                <div className="flex justify-between gap-2">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-200 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                    >
                      {s.name}
                    </a>
                  ) : (
                    <span className="text-neutral-200">{s.name}</span>
                  )}
                  <span className="text-right text-neutral-500">{s.note}</span>
                </div>
                {s.license && <div className="text-[10px] text-neutral-600">{s.license}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
