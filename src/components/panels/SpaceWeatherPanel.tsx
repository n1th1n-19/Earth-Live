"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, X } from "lucide-react";
import type { SpaceWeather } from "@/lib/adapters/swpc";
import type { SpaceWeatherEvent } from "@/lib/adapters/nasa-donki";

function kpDescription(kp: number): string {
  if (kp < 4) return "Quiet";
  if (kp < 5) return "Unsettled";
  if (kp < 6) return "Minor storm";
  if (kp < 7) return "Moderate storm";
  return "Severe storm";
}

export function SpaceWeatherPanel() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery<SpaceWeather>({
    queryKey: ["space-weather"],
    queryFn: async () => {
      const res = await fetch("/api/space-weather");
      if (!res.ok) throw new Error("Failed to fetch space weather");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // NASA DONKI notifications — docs/05-api-integration-guide.md §5.4. Only
  // fetched once the badge is expanded (not on every load), since this is
  // supplementary detail, not the primary at-a-glance reading.
  const { data: events } = useQuery<SpaceWeatherEvent[]>({
    queryKey: ["space-weather-events"],
    queryFn: async () => {
      const res = await fetch("/api/space-weather-events");
      if (!res.ok) throw new Error("Failed to fetch space weather events");
      return res.json();
    },
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });

  if (!data) return null;

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <Zap size={12} className="text-amber-400" />
        Kp {data.kpIndex.toFixed(1)} · {kpDescription(data.kpIndex)}
      </button>

      {open && (
        <div className="mt-2 w-80 rounded-2xl border border-white/10 bg-black/50 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Space weather notifications</span>
            <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-200">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {!events && <div className="text-xs text-neutral-500">Loading…</div>}
            {events?.length === 0 && <div className="text-xs text-neutral-500">No recent notifications.</div>}
            {events?.slice(0, 8).map((event) => (
              <div key={event.id} className="border-b border-white/5 pb-2 text-xs last:border-0">
                <div className="flex justify-between text-neutral-400">
                  <span className="font-mono uppercase">{event.type}</span>
                  <span>{new Date(event.issuedAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 line-clamp-3 text-neutral-300">{event.summary}</div>
              </div>
            ))}
          </div>
          <div className="pt-2 text-[10px] text-neutral-500">Data: NASA DONKI</div>
        </div>
      )}
    </div>
  );
}
