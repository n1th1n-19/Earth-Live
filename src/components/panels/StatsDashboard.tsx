"use client";

import { useState } from "react";
import { BarChart3, X } from "lucide-react";
import { useEarthquakes } from "@/lib/use-earthquakes";
import { useFlights } from "@/lib/use-flights";
import { useWildfires } from "@/lib/use-wildfires";
import { useQuery } from "@tanstack/react-query";
import type { SpaceWeather } from "@/lib/adapters/swpc";

// FR-31. Stat tiles only show real, currently-fetched counts — no
// sparklines yet, since sparklines need a time series and there is no
// continuous ingestion job populating docs/06-database-design.md's
// `cached_*` tables (that needs Vercel Cron, which needs an interactive
// `vercel link` this environment can't run). A fake trend line would
// violate the whole project's no-mock-data rule, so it's just omitted
// rather than faked — see TODO.md.
export function StatsDashboard() {
  const [open, setOpen] = useState(false);
  const { data: quakes } = useEarthquakes();
  const { data: flights } = useFlights();
  const { data: fires } = useWildfires();
  const { data: spaceWeather } = useQuery<SpaceWeather>({
    queryKey: ["space-weather"],
    queryFn: async () => {
      const res = await fetch("/api/space-weather");
      if (!res.ok) throw new Error("Failed to fetch space weather");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const significantQuakes = quakes?.filter((q) => (q.magnitude ?? 0) >= 2.5).length ?? null;

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <BarChart3 size={14} />
        Stats
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-2xl border border-white/10 bg-black/50 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Right now</span>
            <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-200">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <StatTile label="Quakes ≥M2.5 (24h)" value={significantQuakes} />
            <StatTile label="Active fire detections" value={fires?.length ?? null} />
            <StatTile label="Tracked flights" value={flights?.length ?? null} />
            <StatTile label="Kp index" value={spaceWeather?.kpIndex.toFixed(1) ?? null} />
          </div>
          <div className="pt-2 text-[10px] text-neutral-500">
            Live counts only — historical trend lines need continuous ingestion, not yet running.
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-lg bg-white/5 p-2">
      <div className="text-lg text-neutral-100">{value ?? "…"}</div>
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
    </div>
  );
}
