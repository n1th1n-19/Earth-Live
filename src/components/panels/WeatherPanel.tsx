"use client";

import { Loader2, MapPin, Wind, Droplets, Cloud } from "lucide-react";
import type { UserLocation } from "@/lib/geolocation";
import { useWeather } from "@/lib/use-weather";
import { useTimezone } from "@/lib/use-timezone";
import { useUiStore } from "@/lib/store";
import { formatTemperature, formatSpeedKmh } from "@/lib/units";

// Glass panel per docs/04-ui-ux-spec.md §4.2/§4.4 — floating over the globe,
// never blocking it, progressive population per FR-7 (this panel doesn't
// wait on any other layer to render its own data).
export function WeatherPanel({ location }: { location: UserLocation }) {
  const { data, isLoading, isError } = useWeather(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );
  const { data: timezone } = useTimezone(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );
  const units = useUiStore((s) => s.units);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-72 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl"
    >
      {/* pr-6 keeps the location/timezone line clear of the overlaid close
          button (see DismissiblePanel). */}
      <div className="flex items-center gap-2 pr-6 text-xs uppercase tracking-wide text-neutral-400">
        <MapPin size={14} />
        <span>
          {location.source === "gps"
            ? "Your location"
            : location.source === "ip"
              ? "Approximate location"
              : "Default view"}
        </span>
        {timezone && <span className="text-neutral-600">· {timezone.timezoneId}</span>}
      </div>

      {!location.resolved && (
        <div className="mt-3 flex items-center gap-2 text-neutral-400">
          <Loader2 size={14} className="animate-spin" />
          Locating…
        </div>
      )}

      {location.resolved && isLoading && (
        <div className="mt-3 flex items-center gap-2 text-neutral-400">
          <Loader2 size={14} className="animate-spin" />
          Fetching live weather…
        </div>
      )}

      {isError && (
        <div className="mt-3 text-red-400">
          Weather source unavailable — retrying automatically.
        </div>
      )}

      {data && (
        <div className="mt-3 space-y-2">
          <div className="font-mono text-3xl">{formatTemperature(data.temperatureC, units)}</div>
          <div className="text-neutral-400">
            Feels like {formatTemperature(data.apparentTemperatureC, units)}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-xs text-neutral-300">
            <div className="flex items-center gap-1">
              <Wind size={12} /> {formatSpeedKmh(data.windSpeedKmh, units)}
            </div>
            <div className="flex items-center gap-1">
              <Droplets size={12} /> {Math.round(data.humidityPercent)}%
            </div>
            <div className="flex items-center gap-1">
              <Cloud size={12} /> {Math.round(data.cloudCoverPercent)}%
            </div>
          </div>
          <div className="pt-2 text-[10px] text-neutral-500">
            Weather data by Open-Meteo.com · updated{" "}
            {new Date(data.observedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
