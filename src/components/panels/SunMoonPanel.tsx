"use client";

import { useMemo } from "react";
import { Sunrise, Sunset, Moon } from "lucide-react";
import { useSunTimes } from "@/lib/use-sun-times";
import { getMoonInfo } from "@/lib/moon";
import type { UserLocation } from "@/lib/geolocation";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SunMoonPanel({ location }: { location: UserLocation }) {
  const { data } = useSunTimes(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );

  // Moon phase is computed client-side (no API) — always available instantly,
  // independent of the sunrise-sunset.org fetch.
  const moon = useMemo(() => getMoonInfo(new Date()), []);

  if (!location.resolved) return null;

  return (
    <div className="pointer-events-auto w-72 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
      {/* pr-6 keeps the moon-illumination figure clear of the overlaid close
          button (see DismissiblePanel). */}
      <div className="flex items-center justify-between pr-6 font-mono text-xs">
        <div className="flex items-center gap-1.5 text-amber-300">
          <Sunrise size={14} />
          {data ? formatTime(data.sunrise) : "—"}
        </div>
        <div className="flex items-center gap-1.5 text-orange-400">
          <Sunset size={14} />
          {data ? formatTime(data.sunset) : "—"}
        </div>
        <div className="flex items-center gap-1.5 text-neutral-300">
          <Moon size={14} />
          {moon.illuminationPercent}%
        </div>
      </div>
      <div className="mt-1 text-[11px] text-neutral-500">{moon.phaseName}</div>
    </div>
  );
}
