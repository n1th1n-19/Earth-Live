"use client";

import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import type { SpaceWeather } from "@/lib/adapters/swpc";

function kpDescription(kp: number): string {
  if (kp < 4) return "Quiet";
  if (kp < 5) return "Unsettled";
  if (kp < 6) return "Minor storm";
  if (kp < 7) return "Moderate storm";
  return "Severe storm";
}

export function SpaceWeatherPanel() {
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

  if (!data) return null;

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-neutral-200 backdrop-blur-xl">
      <Zap size={12} className="text-amber-400" />
      Kp {data.kpIndex.toFixed(1)} · {kpDescription(data.kpIndex)}
    </div>
  );
}
